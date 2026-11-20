"""CaiX: the two Gemini tasks (concept extraction, graph-guided quiz).

Gemini only proposes. Everything it returns is checked here (and again by the backend:
matching duplicates by meaning, scoring) before it is kept.

Setup:   pip install google-genai pymupdf
         set GEMINI_API_KEY=...                (Windows CMD; PowerShell: $env:GEMINI_API_KEY="...")
         set GEMINI_MODEL=gemini-3.8-flash
Run:     python caix_gemini.py "lecture 1.pdf" ["lecture 2.pdf" ...]
Output:  graph.json and quiz.json in the current folder.

Optional environment variables:
  CAIX_QUESTIONS=8      number of quiz questions (default 5)
  CAIX_TEMPERATURE=0.2  Gemini temperature (default 0.2)
"""
import hashlib
import json
import os
import random
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
EXTRACTION_SCHEMA = json.loads((HERE / "extraction_schema.json").read_text(encoding="utf-8"))
QUIZ_SCHEMA = json.loads((HERE / "quiz_schema.json").read_text(encoding="utf-8"))
REL_TYPES = set(EXTRACTION_SCHEMA["properties"]["relations"]["items"]["properties"]["type"]["enum"])
DIFFICULTIES = ("easy", "medium", "hard")

EXTRACTION_PROMPT = """You are building a concept map for a university student from lecture slides.
Read the pages below. Each page starts with a marker like [[PAGE 12]].

Rules:
- Use ONLY information written in these pages. Do not add outside knowledge.
- List the key concepts a student must know (about 5 to 15 for these pages). Skip titles, agenda slides, names of people, unnamed examples, and sample classes or sample data that only illustrate another concept.
- One id per idea. If the pages use two names for the same thing (for example "POJO" and "Java Bean"), list it once.
- Give each concept a short slug id, a clear name, a one or two sentence definition, and the page numbers where it is explained.
- Add relations only when the pages support them. Try to link every concept to at least one other one; a concept with no link usually means a link was missed.
- Use prerequisite_of when the pages teach A first and B builds on it. Use part_of for components or elements of a bigger thing, example_of for a specific kind or implementation, and contrasts_with for alternatives that the pages compare or list side by side. Use related_to only as a last resort.
- Every relation must point to ids that exist in your concepts list, and carry the page that supports it.
- Page numbers must come from the [[PAGE n]] markers. Never invent a page.
- Write names and definitions in the same language as the pages.

PAGES:
{pages}
"""

QUIZ_PROMPT = """You write exam-style multiple-choice questions for a university student.
Below is one small cluster of a concept graph: concepts and the relations between them, each with its source file and page.

Rules:
- Write {n} questions. At least {rel_min} must need a relation between two concepts (set uses_relation to true), for example "which concept must be understood first" or "how does A differ from B".
- Base every question and answer ONLY on the definitions and relations given. Do not use outside knowledge.
- Exactly 4 options. One correct.
- Make all four options similar in length and detail. The correct option must not be the longest.
- Wrong options must be real mistakes a student could make: use other concepts from this cluster that are easy to confuse with the right one. Never use ideas from clearly different topics.
- Do not copy the question's wording into the correct option.
- In the explanation, never mention "the graph" or "concept graph". Explain like a teacher and point to the page.
- Never refer to options by position (no "option A", "the third option", "Option 0"). The options will be reordered, so describe a wrong idea by what it says.
- Set uses_relation to true only if the answer depends on how two concepts connect (order, part-of, contrast), not on one definition.
- Fill concept_ids with ids from this cluster, and source_file and source_page from the entry that supports the answer.
- Write in the same language as the cluster.

CLUSTER:
{graph}
"""

# Explanations that point at an option by position would be wrong after the options are shuffled.
POSITION_REF = re.compile(
    r"\b(option|choice|answer)\s*(\d|[a-d]\b)|\b(first|second|third|fourth|last)\s+(option|choice|answer)\b",
    re.IGNORECASE,
)


class FatalGeminiError(Exception):
    """Something retrying will not fix (bad key, unknown model, bad request)."""


# ---------- small helpers ----------

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def make_id(text):
    """Same text always gives the same id; text with no latin letters still gets one."""
    text = text.strip() if isinstance(text, str) else ""
    if not text:
        return ""
    return slug(text) or "c-" + hashlib.md5(text.encode("utf-8")).hexdigest()[:6]


def _text(v):
    return v.strip() if isinstance(v, str) else ""


def _int(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return None


def _int_list(v):
    return [i for i in (_int(x) for x in v) if i is not None] if isinstance(v, list) else []


# ---------- reading PDFs ----------

def pdf_to_pages(path):
    try:
        import pymupdf
    except ImportError:  # older PyMuPDF only ships `fitz`
        import fitz as pymupdf
    with pymupdf.open(path) as doc:
        return {i + 1: page.get_text().strip() for i, page in enumerate(doc)}


def chunk_pages(pages, size=8):
    nums = sorted(pages)
    for i in range(0, len(nums), size):
        chunk = {n: pages[n] for n in nums[i:i + size] if pages[n]}
        if chunk:  # a chunk with no text (scanned slides) is skipped
            yield chunk


# ---------- calling Gemini ----------

def _call(prompt, schema, retries=4):
    from google import genai
    from google.genai import types

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise FatalGeminiError("GEMINI_API_KEY is not set in this terminal.")
    model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    cfg = {"response_mime_type": "application/json", "response_schema": schema}
    try:
        cfg["temperature"] = float(os.environ.get("CAIX_TEMPERATURE", "0.2"))
    except ValueError:
        cfg["temperature"] = 0.2
    client = genai.Client(api_key=key)
    last = None
    for attempt in range(retries):
        try:
            resp = client.models.generate_content(
                model=model, contents=prompt, config=types.GenerateContentConfig(**cfg)
            )
            return json.loads(resp.text)
        except Exception as e:  # rate limit, server error, empty or invalid JSON, network
            code = getattr(e, "code", None)
            if code in (400, 401, 403, 404):
                raise FatalGeminiError(
                    f"Gemini rejected the request (HTTP {code}): {getattr(e, 'message', e)}\n"
                    f"Check GEMINI_API_KEY and GEMINI_MODEL (now '{model}')."
                ) from e
            last = e
            if attempt < retries - 1:
                wait = 15 * 2 ** attempt  # 15s, 30s, 60s
                print(f"  Gemini error ({type(e).__name__}); retrying in {wait}s", flush=True)
                time.sleep(wait)
    raise last


# ---------- task 1: concept extraction ----------

def clean_extraction(data, valid_pages):
    """Keep only well-formed concepts and relations that point to real ids and real pages."""
    if not isinstance(data, dict):
        return {"concepts": [], "relations": []}
    seen, concepts = set(), []
    for c in data.get("concepts") or []:
        if not isinstance(c, dict):
            continue
        name = _text(c.get("name"))
        cid = make_id(_text(c.get("id")) or name)
        pages = sorted({p for p in _int_list(c.get("pages")) if p in valid_pages})
        if not name or not cid or cid in seen or not pages:
            continue
        seen.add(cid)
        concepts.append({
            "id": cid,
            "name": name,
            "definition": _text(c.get("definition")),
            "importance": "core" if c.get("importance") == "core" else "supporting",
            "pages": pages,
        })
    relations, rel_seen = [], set()
    for r in data.get("relations") or []:
        if not isinstance(r, dict):
            continue
        s, t, page = make_id(r.get("source_id")), make_id(r.get("target_id")), _int(r.get("page"))
        rtype = r.get("type") if r.get("type") in REL_TYPES else "related_to"
        if s in seen and t in seen and s != t and page in valid_pages and (s, t, rtype) not in rel_seen:
            rel_seen.add((s, t, rtype))
            relations.append({
                "source_id": s, "target_id": t, "type": rtype,
                "explanation": _text(r.get("explanation")), "page": page,
            })
    return {"concepts": concepts, "relations": relations}


def merge_chunks(parts, source_file):
    """Merge the chunks of ONE file: same id = same concept (pages are united).
    Matching by meaning ('BST' vs 'Binary Search Tree') is the backend's job."""
    concepts, relations, seen_rel = {}, [], set()
    for part in parts:
        for c in part["concepts"]:
            if c["id"] in concepts:
                old = concepts[c["id"]]
                old["pages"] = sorted(set(old["pages"]) | set(c["pages"]))
                if c["importance"] == "core":
                    old["importance"] = "core"
            else:
                concepts[c["id"]] = {**c, "source_file": source_file}
        for r in part["relations"]:
            key = (r["source_id"], r["target_id"], r["type"])
            if key not in seen_rel:
                seen_rel.add(key)
                relations.append({**r, "source_file": source_file})
    return {"concepts": list(concepts.values()), "relations": relations}


def combine_files(graphs):
    """Put several files in one graph. An id already used by another file gets a numbered
    file suffix, so two different files never overwrite each other."""
    out_c, out_r, taken = [], [], set()
    for g in graphs:
        rename = {}
        for c in g["concepts"]:
            new_id = c["id"]
            if new_id in taken:
                base = f'{c["id"]}--{slug(Path(c["source_file"]).stem) or "file"}'
                new_id, k = base, 2
                while new_id in taken:
                    new_id, k = f"{base}-{k}", k + 1
            rename[c["id"]] = new_id
            taken.add(new_id)
            out_c.append({**c, "id": new_id})
        for r in g["relations"]:
            out_r.append({**r, "source_id": rename[r["source_id"]], "target_id": rename[r["target_id"]]})
    return {"concepts": out_c, "relations": out_r}


def extract_graph(pdf_path):
    name = Path(pdf_path).name
    pages = pdf_to_pages(pdf_path)
    parts, failed = [], 0
    for chunk in chunk_pages(pages):
        first, last = min(chunk), max(chunk)
        print(f"[{name}] pages {first}-{last} ...", flush=True)
        text = "\n\n".join(f"[[PAGE {n}]]\n{t}" for n, t in chunk.items())
        try:
            raw = _call(EXTRACTION_PROMPT.format(pages=text), EXTRACTION_SCHEMA)
        except FatalGeminiError:
            raise
        except Exception as e:
            failed += 1
            print(f"  skipped pages {first}-{last}: {type(e).__name__}: {e}", flush=True)
            continue
        parts.append(clean_extraction(raw, set(chunk)))
    if failed and not parts:
        raise FatalGeminiError(f"Every chunk of {name} failed. Check the connection and your Gemini quota.")
    if failed:
        print(f"WARNING: {failed} chunk(s) of {name} were skipped. Run again to fill the gaps.", flush=True)
    return merge_chunks(parts, name)


# ---------- task 2: graph-guided quiz ----------

def build_adjacency(graph):
    adj = defaultdict(set)
    for r in graph["relations"]:
        adj[r["source_id"]].add(r["target_id"])
        adj[r["target_id"]].add(r["source_id"])
    return adj


def neighborhood(graph, seed_id, adj, max_concepts=8):
    """A small cluster around one concept: its neighbours first, then neighbours of
    neighbours, then concepts on nearby pages. Wrong options come from this cluster."""
    by_id = {c["id"]: c for c in graph["concepts"]}
    order = lambda i: (-len(adj[i]), i)
    ids = [seed_id] + sorted(adj[seed_id], key=order)
    if len(ids) < 5:
        for n in list(ids[1:]):
            for m in sorted(adj[n], key=order):
                if m not in ids:
                    ids.append(m)
    if len(ids) < 5:
        seed = by_id[seed_id]
        ids += [
            c["id"] for c in graph["concepts"]
            if c["id"] not in ids and c.get("source_file") == seed.get("source_file")
            and any(abs(p - q) <= 2 for p in c["pages"] for q in seed["pages"])
        ]
    ids = ids[:max_concepts]
    keep = set(ids)
    return {
        "concepts": [by_id[i] for i in ids],
        "relations": [r for r in graph["relations"] if r["source_id"] in keep and r["target_id"] in keep],
    }


def pick_seeds(graph, adj, count):
    """Core concepts with many relations first, spread out so clusters differ."""
    ranked = sorted(graph["concepts"], key=lambda c: (c["importance"] != "core", -len(adj[c["id"]]), c["id"]))
    chosen = []
    for c in ranked:
        if len(chosen) == count:
            break
        if all(c["id"] not in adj[s] for s in chosen):
            chosen.append(c["id"])
    for c in ranked:
        if len(chosen) == count:
            break
        if c["id"] not in chosen:
            chosen.append(c["id"])
    return chosen


def _clean_question(q, ids, pages, files):
    """Return a cleaned question, or None if it is malformed or not traceable to the cluster."""
    if not isinstance(q, dict):
        return None
    question, explanation = _text(q.get("question")), _text(q.get("explanation"))
    opts = q.get("options")
    if not question or not explanation or not isinstance(opts, list) or len(opts) != 4:
        return None
    opts = [_text(o) for o in opts]
    if not all(opts) or len({o.lower() for o in opts}) != 4:
        return None
    ci = _int(q.get("correct_index"))
    if ci is None or not 0 <= ci < 4:
        return None
    if POSITION_REF.search(explanation):
        return None
    cids = [i for i in (q.get("concept_ids") if isinstance(q.get("concept_ids"), list) else []) if isinstance(i, str)]
    if not cids or not set(cids) <= ids:
        return None
    page, sfile = _int(q.get("source_page")), _text(q.get("source_file"))
    if page not in pages or sfile not in files:
        return None
    right = len(opts[ci])
    longest_wrong = max(len(o) for i, o in enumerate(opts) if i != ci)
    if right >= 40 and right > 1.5 * longest_wrong:  # a long correct answer that stands out
        return None
    correct = opts[ci]
    random.Random(question).shuffle(opts)  # same question = same order
    diff = q.get("difficulty")
    return {
        "question": question,
        "options": opts,
        "correct_index": opts.index(correct),
        "explanation": explanation,
        "concept_ids": cids,
        "uses_relation": q.get("uses_relation") is True and len(set(cids)) >= 2,
        "source_file": sfile,
        "source_page": page,
        "difficulty": diff if diff in DIFFICULTIES else "medium",
    }


def clean_quiz(data, sub):
    """Keep only questions that are well-formed and traceable to the cluster."""
    if not isinstance(data, dict):
        return []
    ids = {c["id"] for c in sub["concepts"]}
    pages = {p for c in sub["concepts"] for p in c["pages"]} | {r["page"] for r in sub["relations"]}
    files = {c["source_file"] for c in sub["concepts"]}
    cleaned = (_clean_question(q, ids, pages, files) for q in data.get("questions") or [])
    return [q for q in cleaned if q]


def make_quiz(graph, n=5, per_group=2):
    adj = build_adjacency(graph)
    seeds = pick_seeds(graph, adj, -(-n // per_group) + 1)  # one spare in case some questions are dropped
    by_id = {c["id"]: c for c in graph["concepts"]}
    questions, seen_q = [], set()
    for seed in seeds:
        if len(questions) >= n:
            break
        sub = neighborhood(graph, seed, adj)
        if len(sub["concepts"]) < 3:
            continue
        print(f"[quiz] cluster around '{by_id[seed]['name']}' ({len(sub['concepts'])} concepts) ...", flush=True)
        rel_min = max(1, per_group // 2) if sub["relations"] else 0
        prompt = QUIZ_PROMPT.format(n=per_group, rel_min=rel_min, graph=json.dumps(sub, ensure_ascii=False))
        try:
            raw = _call(prompt, QUIZ_SCHEMA)
        except FatalGeminiError:
            raise
        except Exception as e:
            print(f"  skipped this cluster: {type(e).__name__}: {e}", flush=True)
            continue
        for q in clean_quiz(raw, sub):
            key = re.sub(r"\W+", " ", q["question"].lower()).strip()
            if key not in seen_q:
                seen_q.add(key)
                questions.append(q)
    return questions[:n]


# ---------- command line ----------

def print_stats(g):
    linked = {r["source_id"] for r in g["relations"]} | {r["target_id"] for r in g["relations"]}
    alone = [c["name"] for c in g["concepts"] if c["id"] not in linked]
    print("relations by type:", dict(Counter(r["type"] for r in g["relations"])), flush=True)
    print(f"{len(alone)} concepts without any relation" + (": " + ", ".join(alone[:8]) if alone else ""), flush=True)


def main(argv):
    for stream in (sys.stdout, sys.stderr):  # Windows consoles can choke on non-ASCII text
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if not argv:
        return 'Usage: python caix_gemini.py "lecture 1.pdf" ["lecture 2.pdf" ...]'
    missing = [p for p in argv if not Path(p).is_file()]
    if missing:
        return "File not found: " + ", ".join(missing)
    try:
        n = max(1, int(os.environ.get("CAIX_QUESTIONS", "5")))
    except ValueError:
        n = 5
    try:
        g = combine_files([extract_graph(p) for p in argv])
        Path("graph.json").write_text(json.dumps(g, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{len(g['concepts'])} concepts, {len(g['relations'])} relations -> graph.json", flush=True)
        print_stats(g)
        if len(g["concepts"]) < 3:
            return "Too few concepts to make a quiz. Is the PDF a scan without text?"
        q = make_quiz(g, n=n)
        Path("quiz.json").write_text(json.dumps(q, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{len(q)} questions -> quiz.json", flush=True)
        if not q:
            print("WARNING: no question passed the checks. Run again.", flush=True)
    except FatalGeminiError as e:
        return str(e)
    return None


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
