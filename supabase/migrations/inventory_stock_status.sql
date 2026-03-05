-- Add stock_status column to inventory table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'enough';

-- Add check constraint to ensure only valid values are stored
-- Note: null is allowed as per the TypeScript type, but we default to 'enough'
ALTER TABLE public.inventory
DROP CONSTRAINT IF EXISTS inventory_stock_status_check;

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_stock_status_check 
CHECK (stock_status IN ('enough', 'low'));
