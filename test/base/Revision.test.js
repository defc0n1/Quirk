import { Suite, assertThat, assertThrows } from "test/TestUtil.js"
import Revision from "src/base/Revision.js"

let suite = new Suite("Revision");

suite.test("constructor_isEqualTo", () => {
    assertThrows(() => new Revision([], 0, false));
    assertThrows(() => new Revision(["a"], -1, false));
    assertThrows(() => new Revision(["a"], 1, false));
    assertThrows(() => new Revision(["a", "b"], 2, false));

    let r = new Revision(["a", "b", "c"], 1, true);
    assertThat(r).isEqualTo(new Revision(["a", "b", "c"], 1, true));
    assertThat(r).isNotEqualTo(new Revision(["a", "b"], 1, true));
    assertThat(r).isNotEqualTo(new Revision(["a", "b", "d"], 1, true));
    assertThat(r).isNotEqualTo(new Revision(["a", "b", "c"], 2, true));
    assertThat(r).isNotEqualTo(new Revision(["a", "b", "c"], 1, false));
    assertThat(r).isNotEqualTo(undefined);
    assertThat(r).isNotEqualTo(5);

    let groups = [
        [
            new Revision(["a"], 0, false),
            new Revision(["a"], 0, false)
        ],
        [
            new Revision(["a"], 0, true),
            new Revision(["a"], 0, true)
        ],
        [
            new Revision(["a", "b"], 0, false),
            new Revision(["a", "b"], 0, false)
        ],
        [
            new Revision(["b", "a"], 0, false),
            new Revision(["b", "a"], 0, false)
        ],
        [
            new Revision(["b", "a"], 1, false),
            new Revision(["b", "a"], 1, false)
        ]
    ];
    for (let g1 of groups) {
        for (let g2 of groups) {
            for (let e1 of g1) {
                for (let e2 of g2) {
                    if (g1 === g2) {
                        assertThat(e1).isEqualTo(e2);
                    } else {
                        assertThat(e1).isNotEqualTo(e2);
                    }
                }
            }
        }
    }
});

suite.test("toString_exists", () => {
    assertThat(new Revision(["a", "b"], 1, false).toString()).isNotEqualTo(undefined);
});

suite.test("startingAt", () => {
    assertThat(Revision.startingAt("abc")).isEqualTo(new Revision(["abc"], 0, false));
});

suite.test("clear", () => {
    let r;

    r = new Revision(["abc"], 0, false);
    r.clear("xyz");
    assertThat(r).isEqualTo(new Revision(["xyz"], 0, false));

    r = new Revision(["r", "s", "t"], 2, true);
    r.clear("wxyz");
    assertThat(r).isEqualTo(new Revision(["wxyz"], 0, false));
});

suite.test("undo", () => {
    let r;

    r = new Revision(["abc"], 0, false);
    assertThat(r.undo()).isEqualTo(undefined);
    assertThat(r).isEqualTo(new Revision(["abc"], 0, false));

    r = new Revision(["abc", "def"], 0, false);
    assertThat(r.undo()).isEqualTo(undefined);
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, false));

    r = new Revision(["abc", "def"], 0, true);
    assertThat(r.undo()).isEqualTo("abc");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, false));

    r = new Revision(["abc", "def"], 1, false);
    assertThat(r.undo()).isEqualTo("abc");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, false));

    r = new Revision(["abc", "def"], 1, true);
    assertThat(r.undo()).isEqualTo("def");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));

    assertThat(new Revision(["abc", "def", "xyz"], 2, true).undo()).isEqualTo("xyz");
    assertThat(new Revision(["abc", "def", "xyz"], 2, false).undo()).isEqualTo("def");
    assertThat(new Revision(["abc", "def", "xyz"], 1, true).undo()).isEqualTo("def");
    assertThat(new Revision(["abc", "def", "xyz"], 1, false).undo()).isEqualTo("abc");
    assertThat(new Revision(["abc", "def", "xyz"], 0, true).undo()).isEqualTo("abc");
    assertThat(new Revision(["abc", "def", "xyz"], 0, false).undo()).isEqualTo(undefined);
});

suite.test("redo", () => {
    let r;

    r = new Revision(["abc"], 0, false);
    assertThat(r.redo()).isEqualTo(undefined);
    assertThat(r).isEqualTo(new Revision(["abc"], 0, false));

    r = new Revision(["abc", "def"], 0, false);
    assertThat(r.redo()).isEqualTo("def");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));

    r = new Revision(["abc", "def"], 0, true);
    assertThat(r.redo()).isEqualTo("def");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));

    r = new Revision(["abc", "def"], 1, false);
    assertThat(r.redo()).isEqualTo(undefined);
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));

    // Redo-ing when working on a commit with no future state shouldn't lose the in-progress work.
    r = new Revision(["abc", "def"], 1, true);
    assertThat(r.redo()).isEqualTo(undefined);
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, true));

    assertThat(new Revision(["abc", "def", "xyz"], 0, false).redo()).isEqualTo("def");
    assertThat(new Revision(["abc", "def", "xyz"], 0, true).redo()).isEqualTo("def");
    assertThat(new Revision(["abc", "def", "xyz"], 1, false).redo()).isEqualTo("xyz");
    assertThat(new Revision(["abc", "def", "xyz"], 1, true).redo()).isEqualTo("xyz");
    assertThat(new Revision(["abc", "def", "xyz"], 2, false).redo()).isEqualTo(undefined);
    assertThat(new Revision(["abc", "def", "xyz"], 2, true).redo()).isEqualTo(undefined);
});

suite.test("startedWorkingOnCommit", () => {
    let r;

    r = new Revision(["abc"], 0, false);
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc"], 0, true));
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc"], 0, true));

    r = new Revision(["abc", "def"], 0, false);
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, true));
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, true));

    r = new Revision(["abc", "def"], 1, false);
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, true));
    r.startedWorkingOnCommit();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, true));
});

suite.test("cancelCommitBeingWorkedOn", () => {
    let r;

    r = new Revision(["abc"], 0, true);
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc"], 0, false));
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc"], 0, false));

    r = new Revision(["abc", "def"], 0, true);
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, false));
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 0, false));

    r = new Revision(["abc", "def"], 1, true);
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));
    r.cancelCommitBeingWorkedOn();
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));
});

suite.test("commit", () => {
    let r;

    r = new Revision(["abc"], 0, false);
    r.commit("def");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));
    r.commit("xyz");
    assertThat(r).isEqualTo(new Revision(["abc", "def", "xyz"], 2, false));

    r = new Revision(["abc"], 0, true);
    r.commit("def");
    assertThat(r).isEqualTo(new Revision(["abc", "def"], 1, false));

    r = new Revision(["abc", "def"], 0, true);
    r.commit("xyz");
    assertThat(r).isEqualTo(new Revision(["abc", "xyz"], 1, false));

    r = new Revision(["abc", "def", "so", "long"], 1, true);
    r.commit("t");
    assertThat(r).isEqualTo(new Revision(["abc", "def", "t"], 2, false));

    r = new Revision(["abc", "def", "so", "long"], 1, false);
    r.commit("t");
    assertThat(r).isEqualTo(new Revision(["abc", "def", "t"], 2, false));
});
