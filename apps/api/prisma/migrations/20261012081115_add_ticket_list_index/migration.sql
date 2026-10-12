-- CreateIndex
CREATE INDEX "tickets_tenant_id_updated_at_id_idx" ON "tickets"("tenant_id", "updated_at" DESC, "id" DESC);
