-- 収支シミュレーション（投資判断ごとに複数保存、物件同士の比較用）
-- property_analyses に紐づく。前提・結果をフラットカラムで保存して比較・検索しやすくする。

CREATE TABLE IF NOT EXISTS cashflow_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_analysis_id UUID NOT NULL REFERENCES property_analyses(id) ON DELETE CASCADE,

  -- 前提（スナップショット）
  property_price_yen INTEGER NOT NULL,
  acquisition_cost_yen INTEGER NOT NULL,
  down_payment_yen INTEGER NOT NULL,
  loan_amount_yen INTEGER NOT NULL,
  interest_rate NUMERIC(6,4) NOT NULL DEFAULT 0.02,
  loan_years INTEGER NOT NULL DEFAULT 30,
  assumed_rent_yen INTEGER NOT NULL,
  vacancy_rate NUMERIC(4,2) NOT NULL DEFAULT 0.05,
  opex_rate NUMERIC(4,2) NOT NULL DEFAULT 0.20,

  -- 結果（年間）
  gpi_yen INTEGER NOT NULL,
  vacancy_loss_yen INTEGER NOT NULL,
  egi_yen INTEGER NOT NULL,
  opex_yen INTEGER NOT NULL,
  noi_yen INTEGER NOT NULL,
  ads_yen INTEGER NOT NULL,
  btcf_yen INTEGER NOT NULL,
  monthly_repayment_yen INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashflow_simulations_property_analysis_id
  ON cashflow_simulations(property_analysis_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_simulations_created_at
  ON cashflow_simulations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashflow_simulations_noi_yen
  ON cashflow_simulations(noi_yen);
CREATE INDEX IF NOT EXISTS idx_cashflow_simulations_btcf_yen
  ON cashflow_simulations(btcf_yen);

ALTER TABLE cashflow_simulations ENABLE ROW LEVEL SECURITY;

-- 投資判断が参照できればシミュレーションも参照可（既存の property_analyses の SELECT に合わせる）
CREATE POLICY "Cashflow simulations are viewable with property_analyses"
  ON cashflow_simulations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cashflow_simulations"
  ON cashflow_simulations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete cashflow_simulations"
  ON cashflow_simulations FOR DELETE
  USING (true);
