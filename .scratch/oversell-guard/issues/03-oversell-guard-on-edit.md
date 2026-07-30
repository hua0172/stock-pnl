# 03 — Oversell guard on editing a transaction

**What to build:** `updateTransaction` fetches the (post-edit) symbol's existing transactions excluding the transaction being edited, appends the edited version, and validates. If the edit changes which symbol the transaction belongs to, also validates the original symbol's remaining transactions with this transaction removed (equivalent to a delete from that symbol's perspective). Either failing validation blocks the save with the same error message format as adding.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Editing a transaction so it would exceed its symbol's holdings at its trade date is blocked with an error, verified manually in the browser
- [ ] Editing a transaction's symbol in a way that would make the *original* symbol's remaining transactions invalid is also blocked
- [ ] Editing a transaction with no resulting violation still succeeds as before
