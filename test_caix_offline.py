"""Offline checks for caix_gemini.py. No API key and no internet needed (Gemini is replaced
by a fake). Needs only: pip install pymupdf

Run:  python -m unittest test_caix_offline -v
"""
import json
import os
import re
import tempfile
import unittest
from pathlib import Path

import caix_gemini as m


def make_pdf(path, pages):
    try:
        import pymupdf
    except ImportError:
        import fitz as pymupdf
    doc = pymupdf.open()
    for i in range(pages):
        doc.new_page().insert_text((72, 72), f"Slide {i + 1} text about the topic")
    doc.save(str(path))
    doc.close()


def concept(cid, pages, name=None, importance="supporting"):
    return {"id": cid, "name": name or cid, "definition": "d", "importance": importance, "pages": pages}


def relation(s, t, page, rtype="related_to"):
    return {"source_id": s, "target_id": t, "type": rtype, "explanation": "e", "page": page}


def question(text, options, ci, ids, page, source_file, uses_relation=True, explanation="See page 1.", difficulty="easy"):
    return {
        "question": text, "options": options, "correct_index": ci, "explanation": explanation,
        "concept_ids": ids, "uses_relation": uses_relation, "source_file": source_file,
        "source_page": page, "difficulty": difficulty,
    }


class FakeGemini:
    """Stands in for m._call. `extraction` and `quiz` are functions of the prompt."""

    def __init__(self, extraction=None, quiz=None):
        self.extraction, self.quiz, self.calls = extraction, quiz, []

    def __call__(self, prompt, schema, retries=4):
        self.calls.append("quiz" if schema is m.QUIZ_SCHEMA else "extraction")
        if schema is m.EXTRACTION_SCHEMA:
            return self.extraction(prompt)
        return self.quiz(prompt)


def first_page(prompt):
    return int(re.findall(r"\[\[PAGE (\d+)\]\]", prompt.split("PAGES:\n")[1])[0])


def cluster(prompt):
    return json.loads(prompt.split("CLUSTER:\n")[1])


class CleaningTests(unittest.TestCase):
    def test_relation_ids_match_concept_ids_even_with_different_spelling(self):
        raw = {
            "concepts": [concept("Binary-Tree", [1], "Binary Tree"), concept("Heap", [1])],
            "relations": [relation("Binary Tree", "heap", 1, "prerequisite_of")],
        }
        out = m.clean_extraction(raw, {1})
        self.assertEqual([c["id"] for c in out["concepts"]], ["binary-tree", "heap"])
        self.assertEqual(len(out["relations"]), 1)
        self.assertEqual(out["relations"][0]["source_id"], "binary-tree")

    def test_invented_pages_ids_and_duplicates_are_removed(self):
        raw = {
            "concepts": [concept("a", [1, 99]), concept("a", [1]), concept("ghost", [99]), concept("b", [2])],
            "relations": [
                relation("a", "b", 2), relation("a", "b", 2), relation("a", "nope", 1),
                relation("a", "a", 1), relation("a", "b", 99),
            ],
        }
        out = m.clean_extraction(raw, {1, 2})
        self.assertEqual([c["id"] for c in out["concepts"]], ["a", "b"])
        self.assertEqual(out["concepts"][0]["pages"], [1])
        self.assertEqual(len(out["relations"]), 1)

    def test_unknown_relation_type_becomes_related_to(self):
        raw = {"concepts": [concept("a", [1]), concept("b", [1])], "relations": [relation("a", "b", 1, "weird")]}
        self.assertEqual(m.clean_extraction(raw, {1})["relations"][0]["type"], "related_to")

    def test_malformed_gemini_output_never_crashes(self):
        junk = [
            None, "text", [], {}, {"concepts": "x"}, {"concepts": [None, 5, {}, {"name": 3}]},
            {"concepts": [{"name": "A", "pages": "1"}], "relations": [{"source_id": 1}]},
            {"concepts": [{"name": "A", "id": "a", "pages": ["1", True]}], "relations": "no"},
        ]
        for data in junk:
            out = m.clean_extraction(data, {1})
            self.assertIn("concepts", out)
            self.assertIn("relations", out)
        sub = {"concepts": [dict(concept("a", [1]), source_file="f.pdf")], "relations": []}
        for data in [None, "x", {}, {"questions": [None, 1, {}, {"options": "abcd"}]}]:
            self.assertEqual(m.clean_quiz(data, sub), [])

    def test_names_without_latin_letters_still_get_ids(self):
        out = m.clean_extraction({"concepts": [concept("", [1], "データ構造")]}, {1})
        self.assertEqual(len(out["concepts"]), 1)
        self.assertTrue(out["concepts"][0]["id"].startswith("c-"))


class MergeTests(unittest.TestCase):
    def test_same_id_in_two_chunks_is_merged(self):
        p1 = {"concepts": [concept("a", [1])], "relations": []}
        p2 = {"concepts": [concept("a", [9], importance="core"), concept("b", [9])], "relations": [relation("a", "b", 9)]}
        out = m.merge_chunks([p1, p2], "f.pdf")
        a = [c for c in out["concepts"] if c["id"] == "a"][0]
        self.assertEqual((a["pages"], a["importance"], a["source_file"]), ([1, 9], "core", "f.pdf"))
        self.assertEqual(out["relations"][0]["source_file"], "f.pdf")

    def test_files_never_overwrite_each_other(self):
        def g(name):
            return m.merge_chunks([{"concepts": [concept("a", [1]), concept("b", [1])], "relations": [relation("a", "b", 1)]}], name)
        out = m.combine_files([g("lecture.pdf"), g("lecture.pdf"), g("other.pdf")])
        ids = [c["id"] for c in out["concepts"]]
        self.assertEqual(len(ids), 6)
        self.assertEqual(len(set(ids)), 6)
        known = set(ids)
        self.assertTrue(all(r["source_id"] in known and r["target_id"] in known for r in out["relations"]))


class QuizTests(unittest.TestCase):
    def setUp(self):
        self.sub = {
            "concepts": [dict(concept("a", [1, 2]), source_file="f.pdf"), dict(concept("b", [2]), source_file="f.pdf")],
            "relations": [dict(relation("a", "b", 2), source_file="f.pdf")],
        }
        self.opts = ["alpha one", "beta two", "gamma three", "delta four"]

    def q(self, **over):
        base = question("Q?", list(self.opts), 0, ["a", "b"], 2, "f.pdf")
        base.update(over)
        return {"questions": [base]}

    def test_good_question_is_kept_and_shuffle_keeps_the_right_answer(self):
        out = m.clean_quiz(self.q(), self.sub)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["options"][out[0]["correct_index"]], "alpha one")
        self.assertEqual(sorted(out[0]["options"]), sorted(self.opts))

    def test_bad_questions_are_dropped(self):
        bad = [
            dict(options=["x", "x", "y", "z"]), dict(options=["a", "b", "c"]), dict(options=["a", "b", "c", ""]),
            dict(correct_index=4), dict(correct_index=-1), dict(concept_ids=["nope"]), dict(concept_ids=[]),
            dict(source_page=77), dict(source_file="other.pdf"),
            dict(explanation="The third option is wrong."), dict(explanation="Option 0 is wrong."),
            dict(explanation="Choice B is the answer."), dict(question=""), dict(explanation=""),
            dict(options=["x" * 90, "b" * 30, "c" * 30, "d" * 30]),
        ]
        for over in bad:
            self.assertEqual(m.clean_quiz(self.q(**over), self.sub), [], over)

    def test_page_references_that_are_not_option_positions_are_fine(self):
        for ok in ("See page 2.", "The answer is on page 2.", "The Model handles data."):
            self.assertEqual(len(m.clean_quiz(self.q(explanation=ok), self.sub)), 1, ok)

    def test_short_correct_answers_are_not_penalised(self):
        out = m.clean_quiz(self.q(options=["Controller", "Model", "View", "Tag"]), self.sub)
        self.assertEqual(len(out), 1)

    def test_uses_relation_needs_two_concepts_and_difficulty_is_normalised(self):
        out = m.clean_quiz(self.q(concept_ids=["a"], uses_relation=True, difficulty="impossible"), self.sub)
        self.assertFalse(out[0]["uses_relation"])
        self.assertEqual(out[0]["difficulty"], "medium")

    def test_clusters_stay_small_and_contain_their_seed(self):
        concepts = [dict(concept(f"c{i}", [i + 1]), source_file="f.pdf") for i in range(20)]
        rels = [relation("c0", f"c{i}", i + 1) for i in range(1, 15)]
        g = {"concepts": concepts, "relations": rels}
        adj = m.build_adjacency(g)
        sub = m.neighborhood(g, "c0", adj)
        self.assertLessEqual(len(sub["concepts"]), 8)
        self.assertEqual(sub["concepts"][0]["id"], "c0")
        sparse = m.neighborhood(g, "c19", adj)  # no relations: falls back to nearby pages
        self.assertEqual(sparse["concepts"][0]["id"], "c19")
        self.assertGreaterEqual(len(sparse["concepts"]), 3)

    def test_seeds_prefer_core_and_spread_out(self):
        concepts = [dict(concept(x, [1], importance="core" if x in "ad" else "supporting"), source_file="f.pdf") for x in "abcd"]
        g = {"concepts": concepts, "relations": [relation("a", "b", 1), relation("a", "c", 1)]}
        seeds = m.pick_seeds(g, m.build_adjacency(g), 2)
        self.assertEqual(seeds[0], "a")
        self.assertEqual(seeds[1], "d")


class EndToEndTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_cwd, self.old_call = os.getcwd(), m._call
        os.chdir(self.tmp.name)

    def tearDown(self):
        os.chdir(self.old_cwd)
        m._call = self.old_call
        self.tmp.cleanup()

    @staticmethod
    def extraction(prompt):
        p = first_page(prompt)
        ids = [f"c{p}-{x}" for x in "abc"]
        return {
            "concepts": [concept(i, [p], importance="core") for i in ids],
            "relations": [relation(ids[0], ids[1], p, "prerequisite_of"), relation(ids[1], ids[2], p, "part_of")],
        }

    @staticmethod
    def quiz(prompt):
        c = cluster(prompt)
        ids = [x["id"] for x in c["concepts"]]
        c0 = c["concepts"][0]
        make = lambda t: question(t, ["alpha one", "beta two", "gamma three", "delta four"], 0, ids[:2], c0["pages"][0], c0["source_file"])
        return {"questions": [make(f"Question about {ids[0]}?"), make(f"Question about {ids[1]}?")]}

    def test_full_run_with_spaces_in_the_file_name(self):
        make_pdf(Path("10 - MVC part 1.pdf"), 20)
        m._call = FakeGemini(self.extraction, self.quiz)
        self.assertIsNone(m.main(["10 - MVC part 1.pdf"]))
        g = json.loads(Path("graph.json").read_text(encoding="utf-8"))
        q = json.loads(Path("quiz.json").read_text(encoding="utf-8"))
        self.assertEqual(len(g["concepts"]), 9)  # 3 chunks of 8, 8 and 4 pages
        self.assertEqual(len(q), 5)
        ids = {c["id"] for c in g["concepts"]}
        self.assertTrue(all(r["source_id"] in ids and r["target_id"] in ids for r in g["relations"]))
        self.assertTrue(all(c["source_file"] == "10 - MVC part 1.pdf" for c in g["concepts"]))
        self.assertTrue(all(x["options"][x["correct_index"]] == "alpha one" for x in q))

    def test_failed_chunk_is_skipped_and_the_rest_is_kept(self):
        make_pdf(Path("a.pdf"), 16)
        state = {"n": 0}

        def flaky(prompt):
            state["n"] += 1
            if state["n"] == 1:
                raise RuntimeError("boom")
            return self.extraction(prompt)

        m._call = FakeGemini(flaky, self.quiz)
        g = m.extract_graph("a.pdf")
        self.assertEqual(len(g["concepts"]), 3)  # only the second chunk survived

    def test_all_chunks_failing_is_reported_clearly(self):
        make_pdf(Path("a.pdf"), 3)

        def broken(prompt):
            raise RuntimeError("boom")

        m._call = FakeGemini(broken, self.quiz)
        with self.assertRaises(m.FatalGeminiError):
            m.extract_graph("a.pdf")

    def test_fatal_error_stops_with_a_message_not_a_traceback(self):
        make_pdf(Path("a.pdf"), 3)

        def fatal(prompt):
            raise m.FatalGeminiError("bad model name")

        m._call = FakeGemini(fatal, self.quiz)
        self.assertEqual(m.main(["a.pdf"]), "bad model name")

    def test_missing_file_and_no_arguments(self):
        self.assertIn("File not found", m.main(["nope.pdf"]))
        self.assertIn("Usage", m.main([]))

    def test_pdf_without_text_is_explained(self):
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
        doc = pymupdf.open()
        doc.new_page()
        doc.save("scan.pdf")
        doc.close()
        m._call = FakeGemini(self.extraction, self.quiz)
        self.assertIn("Too few concepts", m.main(["scan.pdf"]))

    def test_quiz_questions_are_not_repeated(self):
        make_pdf(Path("a.pdf"), 8)
        same = lambda prompt: {"questions": [question("Same question?", ["alpha one", "beta two", "gamma three", "delta four"], 0,
                                                       [cluster(prompt)["concepts"][0]["id"]], cluster(prompt)["concepts"][0]["pages"][0],
                                                       cluster(prompt)["concepts"][0]["source_file"], uses_relation=False)]}
        m._call = FakeGemini(self.extraction, same)
        g = m.extract_graph("a.pdf")
        self.assertEqual(len(m.make_quiz(g, n=3)), 1)


class PromptTests(unittest.TestCase):
    def test_prompts_format_without_errors_and_carry_the_key_rules(self):
        self.assertIn("[[PAGE 3]]", m.EXTRACTION_PROMPT.format(pages="[[PAGE 3]]\nx"))
        text = m.QUIZ_PROMPT.format(n=2, rel_min=1, graph="{}")
        self.assertIn("Never refer to options by position", text)
        self.assertIn("prerequisite_of when the pages teach", m.EXTRACTION_PROMPT)

    def test_schemas_require_every_field_the_code_reads(self):
        q = m.QUIZ_SCHEMA["properties"]["questions"]["items"]["required"]
        for key in ("question", "options", "correct_index", "explanation", "concept_ids", "uses_relation", "source_file", "source_page", "difficulty"):
            self.assertIn(key, q)
        c = m.EXTRACTION_SCHEMA["properties"]["concepts"]["items"]["required"]
        for key in ("id", "name", "definition", "importance", "pages"):
            self.assertIn(key, c)


if __name__ == "__main__":
    unittest.main()
