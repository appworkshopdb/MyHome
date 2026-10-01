-- Profilbild (256×256 JPEG als Data-URL, ca. 15–30 KB)
alter table public.body_profile add column if not exists avatar text;
