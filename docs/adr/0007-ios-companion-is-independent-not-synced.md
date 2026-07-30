# iOS companion app has its own independent data — no sync with this app

A native iOS app (`~/projects/stock-pnl-ios`, separate repo) now exists alongside this web app, tracking the same domain (Transaction, Weighted-Average Cost, P&L) but with its own local SwiftData store on-device. It does not read from or write to this app's SQLite database, and the two are never synced — a transaction entered in one does not appear in the other.

This follows directly from this app's own "personal, local-only" design (see `CONTEXT.md`'s opening line): making the two apps share live data would require this app's Mac-local SQLite database to become network-reachable from a phone — at minimum a server process staying reachable on the same network, more realistically a real backend — which is a substantially bigger architectural change than adding an iOS client. Independent data was chosen to let the iOS app exist and prove its value without first taking on that change.

Consequence for a future reader: don't assume the iOS app is a "thin client" of this one, and don't expect transaction history to reconcile between them. If shared, synced data is ever wanted, revisit this decision on both sides — it changes this app's local-only architecture, not just the iOS app's.
