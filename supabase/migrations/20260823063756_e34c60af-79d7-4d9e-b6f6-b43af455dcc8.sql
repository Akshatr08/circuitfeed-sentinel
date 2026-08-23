CREATE TABLE public.hackathons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  organizer TEXT,
  deadline_text TEXT,
  prize TEXT,
  participation_mode TEXT,
  url TEXT NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hackathons TO anon;
GRANT SELECT ON public.hackathons TO authenticated;
GRANT ALL ON public.hackathons TO service_role;
ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hackathons are publicly readable" ON public.hackathons FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.scraper_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collector_id TEXT NOT NULL,
  status TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  valid_record_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT ON public.scraper_runs TO anon;
GRANT SELECT ON public.scraper_runs TO authenticated;
GRANT ALL ON public.scraper_runs TO service_role;
ALTER TABLE public.scraper_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scraper runs are publicly readable" ON public.scraper_runs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.recovery_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collector_id TEXT NOT NULL,
  failure_run_id UUID REFERENCES public.scraper_runs(id) ON DELETE SET NULL,
  healing_status TEXT NOT NULL DEFAULT 'logged',
  records_before INTEGER NOT NULL DEFAULT 0,
  records_after INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recovery_events TO anon;
GRANT SELECT ON public.recovery_events TO authenticated;
GRANT ALL ON public.recovery_events TO service_role;
ALTER TABLE public.recovery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recovery events are publicly readable" ON public.recovery_events FOR SELECT TO anon, authenticated USING (true);