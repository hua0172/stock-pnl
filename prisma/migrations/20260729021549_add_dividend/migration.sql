-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "market" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "fxRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DividendAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "dividendId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Dividend_symbol_idx" ON "Dividend"("symbol");

-- CreateIndex
CREATE INDEX "DividendAuditLog_createdAt_idx" ON "DividendAuditLog"("createdAt");
