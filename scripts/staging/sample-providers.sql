-- Sample service providers for STAGING demos (never production).
-- Every business is labelled "(sample)", has no members or logins, no reviews, and an approval that
-- says it is not a real verification. Re-running replaces them; remove with remove-sample-providers.sql.
--
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/staging/sample-providers.sql
begin;

delete from public.organizations where id::text like '70000000-0000-4000-8000-%';

create temp table sample_provider (
  n int primary key, name text, slug text, tagline text, description text,
  book_now boolean, urgent boolean, availability text, phone text, email text, year_established int, team_size int
) on commit drop;

insert into sample_provider values
  (1, 'Lapu-Lapu AquaFix Plumbing (sample)', 'lapu-lapu-aquafix-plumbing-sample',
   'Leaks, clogs and water heaters across Mactan and Mandaue',
   'Plumbing repairs, pipe replacement and fixture installation for homes and condos in Lapu-Lapu, Mandaue and Cebu City. Sample business for staging.',
   true, true, 'available', '+63 900 000 0001', 'hello@aquafix.example', 2016, 6),
  (2, 'Mactan CoolAir Aircon Services (sample)', 'mactan-coolair-aircon-sample',
   'Aircon cleaning, repair and installation on Mactan Island',
   'Window and split-type aircon cleaning, freon recharge and repair, plus appliance repair. Sample business for staging.',
   true, false, 'limited', '+63 900 000 0002', 'book@coolair.example', 2019, 4),
  (3, 'Sugbo Spark Electrical (sample)', 'sugbo-spark-electrical-sample',
   'Licensed electricians serving all of Cebu',
   'Wiring, breaker panels, outlets and safety inspections anywhere in Cebu province. Sample business for staging.',
   true, true, 'available', '+63 900 000 0003', 'service@sugbospark.example', 2012, 9),
  (4, 'Linis Bahay Cleaning Co. (sample)', 'linis-bahay-cleaning-sample',
   'Deep cleaning and pest control for Metro Manila homes',
   'General and deep cleaning, move-in/move-out cleaning and pest control in Quezon City, Makati, Pasig and Taguig. Sample business for staging.',
   true, false, 'available', '+63 900 000 0004', 'hello@linisbahay.example', 2018, 15),
  (5, 'Mactan Build & Renovate (sample)', 'mactan-build-renovate-sample',
   'Kitchen, bathroom and whole-house renovation in Cebu',
   'Design-and-build renovation, tiling and roofing/waterproofing for houses in Metro Cebu. Site visit and quotation first. Sample business for staging.',
   false, false, 'available', '+63 900 000 0005', 'projects@mactanbuild.example', 2010, 25),
  (6, 'Narra Woodworks Cabinetry (sample)', 'narra-woodworks-cabinetry-sample',
   'Custom kitchen cabinets, closets and furniture',
   'Made-to-measure cabinetry and furniture built in our Mandaue workshop and installed across Metro Cebu. Sample business for staging.',
   false, false, 'limited', '+63 900 000 0006', 'orders@narrawood.example', 2008, 12),
  (7, 'Kulay Painting Services (sample)', 'kulay-painting-services-sample',
   'Interior and exterior painting with clean, on-time crews',
   'Interior and exterior repainting, wall repair and waterproofing in Makati, Pasig and Mandaluyong. Sample business for staging.',
   false, false, 'available', '+63 900 000 0007', 'quote@kulay.example', 2015, 10),
  (8, 'Paws & Bubbles Mobile Grooming (sample)', 'paws-bubbles-mobile-grooming-sample',
   'Grooming van that comes to your gate',
   'Bath, haircut, nail trim and ear cleaning for dogs and cats in our mobile grooming van, plus pet sitting. Sample business for staging.',
   true, false, 'available', '+63 900 000 0008', 'woof@pawsbubbles.example', 2020, 5),
  (9, 'VetCall Home Visits (sample)', 'vetcall-home-visits-sample',
   'Licensed veterinarians who visit your home',
   'Check-ups, vaccinations and basic treatment at home, plus obedience training. Sample business for staging.',
   true, true, 'limited', '+63 900 000 0009', 'care@vetcall.example', 2017, 7),
  (10, 'Island Auto Care (sample)', 'island-auto-care-sample',
   'PMS, repairs and 24/7 roadside help in Metro Cebu',
   'Preventive maintenance, diagnostics and repair for cars and SUVs, with roadside assistance across Metro Cebu. Sample business for staging.',
   true, true, 'available', '+63 900 000 0010', 'service@islandauto.example', 2011, 14),
  (11, 'Shine Mobile Car Wash (sample)', 'shine-mobile-car-wash-sample',
   'Car wash, detailing and motorcycle service at your home',
   'Waterless wash, interior detailing and motorcycle tune-ups at your home or office in Taguig, Makati and Parañaque. Sample business for staging.',
   true, false, 'available', '+63 900 000 0011', 'hello@shinewash.example', 2021, 6);

insert into public.organizations (id, kind, name, slug)
select ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'service_provider', name, slug from sample_provider;

-- organizations_provider_profile created a blank profile for each; fill and publish it.
update public.provider_profiles pp set
  tagline = s.tagline, description = s.description, phone = s.phone, email = s.email,
  year_established = s.year_established, team_size = s.team_size,
  accepts_book_now = s.book_now, accepts_quote_requests = true, accepts_contact = true, accepts_urgent = s.urgent,
  availability_status = s.availability, availability_updated_at = now(), is_published = true,
  business_hours = '{"mon":[["08:00","18:00"]],"tue":[["08:00","18:00"]],"wed":[["08:00","18:00"]],"thu":[["08:00","18:00"]],"fri":[["08:00","18:00"]],"sat":[["08:00","15:00"]]}'
from sample_provider s
where pp.organization_id = ('70000000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid;

insert into public.provider_services
  (organization_id, category_id, title, description, pricing_model, price_centavos, unit_label, duration_minutes, allows_book_now)
select ('70000000-0000-4000-8000-' || lpad(t.n::text, 12, '0'))::uuid, c.id, t.title, t.descr, t.model, t.price, t.unit, t.minutes, t.book
from (values
  (1, 'plumbing', 'Leak repair', 'Faucets, pipes, toilets and fixtures', 'starting_at', 70000::bigint, '', 60, true),
  (1, 'plumbing', 'Declogging', 'Sinks, floor drains and toilets', 'fixed', 85000::bigint, '', 60, true),
  (1, 'plumbing', 'Water heater installation', 'Supply not included', 'fixed', 180000::bigint, 'per unit', 120, true),
  (1, 'handyman', 'Handyman visit', 'Small repairs and installations', 'hourly', 45000::bigint, 'per hour', 60, true),
  (2, 'aircon', 'Aircon cleaning (window type)', 'Full cleaning with chemical wash', 'fixed', 80000::bigint, 'per unit', 60, true),
  (2, 'aircon', 'Aircon cleaning (split type)', 'Indoor and outdoor units', 'fixed', 150000::bigint, 'per unit', 90, true),
  (2, 'aircon', 'Freon recharge', 'Leak check included', 'starting_at', 250000::bigint, '', 90, true),
  (2, 'appliance-repair', 'Ref and washing machine repair', 'Diagnosis fee deducted from repair', 'starting_at', 60000::bigint, '', 60, true),
  (3, 'electrical', 'Outlet and switch repair', 'Per location', 'starting_at', 50000::bigint, '', 45, true),
  (3, 'electrical', 'Breaker panel upgrade', 'Materials quoted separately', 'quote_only', null, '', null, false),
  (3, 'electrical', 'Electrical safety inspection', 'Wiring, panel and grounding check with report', 'fixed', 150000::bigint, '', 90, true),
  (4, 'cleaning', 'General house cleaning', '2 cleaners', 'hourly', 35000::bigint, 'per hour', 180, true),
  (4, 'cleaning', 'Deep cleaning', 'Kitchen, bathrooms, floors and windows', 'starting_at', 450000::bigint, '', 360, true),
  (4, 'pest-control', 'Termite and pest treatment', 'Inspection first', 'quote_only', null, '', null, false),
  (5, 'renovation', 'Kitchen renovation', 'Design, demolition, plumbing, tiling and cabinets', 'quote_only', null, '', null, false),
  (5, 'renovation', 'Bathroom renovation', 'Full remodel including fixtures', 'quote_only', null, '', null, false),
  (5, 'masonry-tiling', 'Floor and wall tiling', 'Labor only', 'per_unit', 45000::bigint, 'per sq m', null, false),
  (5, 'roofing', 'Roof repair and waterproofing', 'Leak inspection included', 'quote_only', null, '', null, false),
  (6, 'carpentry', 'Kitchen cabinets', 'Marine plywood with laminate finish', 'per_unit', 1800000::bigint, 'per linear m', null, false),
  (6, 'carpentry', 'Built-in closet', 'Floor-to-ceiling', 'quote_only', null, '', null, false),
  (6, 'custom-furniture', 'Custom furniture', 'Tables, shelves and beds made to order', 'quote_only', null, '', null, false),
  (7, 'painting', 'Interior repainting', 'Paint and labor', 'per_unit', 25000::bigint, 'per sq m', null, false),
  (7, 'painting', 'Exterior repainting', 'Includes surface prep', 'quote_only', null, '', null, false),
  (7, 'roofing', 'Wall and roof waterproofing', 'Elastomeric coating', 'per_unit', 35000::bigint, 'per sq m', null, false),
  (8, 'pet-grooming', 'Full groom (small dog)', 'Bath, haircut, nails and ears', 'fixed', 90000::bigint, '', 90, true),
  (8, 'pet-grooming', 'Full groom (large dog)', 'Bath, haircut, nails and ears', 'fixed', 150000::bigint, '', 120, true),
  (8, 'pet-grooming', 'Cat grooming', 'Bath, trim and nails', 'fixed', 110000::bigint, '', 90, true),
  (8, 'pet-sitting', 'Home pet sitting', 'Feeding, walks and play', 'fixed', 60000::bigint, 'per visit', 60, true),
  (9, 'vet-home-visit', 'Home check-up', 'Physical exam and consultation', 'fixed', 150000::bigint, '', 60, true),
  (9, 'vet-home-visit', 'Vaccination at home', 'Vaccine priced separately', 'starting_at', 120000::bigint, '', 45, true),
  (9, 'pet-training', 'Obedience training', 'Package of 6 sessions', 'fixed', 900000::bigint, 'per package', 60, false),
  (10, 'car-maintenance', 'Preventive maintenance service', 'Oil, filters and 30-point check', 'starting_at', 350000::bigint, '', 120, true),
  (10, 'car-repair', 'Engine diagnostics', 'OBD scan and road test', 'fixed', 120000::bigint, '', 60, true),
  (10, 'car-repair', 'Brake service', 'Pads, rotors and fluid', 'quote_only', null, '', null, false),
  (10, 'roadside-assistance', 'Roadside assistance', 'Jump-start, flat tire and towing referral', 'starting_at', 100000::bigint, '', 60, true),
  (11, 'car-wash', 'Waterless car wash', 'At your home or office', 'fixed', 50000::bigint, 'per car', 60, true),
  (11, 'car-wash', 'Interior detailing', 'Vacuum, shampoo and dashboard care', 'fixed', 250000::bigint, 'per car', 180, true),
  (11, 'motorcycle-service', 'Motorcycle tune-up', 'Oil change, chain and brakes', 'fixed', 80000::bigint, '', 60, true)
) as t(n, slug, title, descr, model, price, unit, minutes, book)
join public.service_categories c on c.slug = t.slug;

insert into public.service_areas (organization_id, province, city_municipality)
select ('70000000-0000-4000-8000-' || lpad(t.n::text, 12, '0'))::uuid, t.province, t.city
from (values
  (1, 'Cebu', 'Lapu-Lapu'), (1, 'Cebu', 'Mandaue'), (1, 'Cebu', 'Cebu City'),
  (2, 'Cebu', 'Lapu-Lapu'), (2, 'Cebu', 'Cordova'),
  (3, 'Cebu', null),
  (4, 'Metro Manila', 'Quezon City'), (4, 'Metro Manila', 'Makati'), (4, 'Metro Manila', 'Pasig'), (4, 'Metro Manila', 'Taguig'),
  (5, 'Cebu', 'Lapu-Lapu'), (5, 'Cebu', 'Cordova'), (5, 'Cebu', 'Mandaue'), (5, 'Cebu', 'Cebu City'),
  (6, 'Cebu', 'Mandaue'), (6, 'Cebu', 'Lapu-Lapu'), (6, 'Cebu', 'Cebu City'), (6, 'Cebu', 'Talisay'),
  (7, 'Metro Manila', 'Makati'), (7, 'Metro Manila', 'Pasig'), (7, 'Metro Manila', 'Mandaluyong'),
  (8, 'Cebu', 'Lapu-Lapu'), (8, 'Cebu', 'Mandaue'), (8, 'Cebu', 'Cebu City'),
  (9, 'Metro Manila', 'Quezon City'), (9, 'Metro Manila', 'Manila'), (9, 'Metro Manila', 'San Juan'),
  (10, 'Cebu', 'Lapu-Lapu'), (10, 'Cebu', 'Mandaue'), (10, 'Cebu', 'Cebu City'),
  (11, 'Metro Manila', 'Taguig'), (11, 'Metro Manila', 'Makati'), (11, 'Metro Manila', 'Parañaque')
) as t(n, province, city);

-- Listing requires a current approved verification. These are explicitly NOT real verifications.
insert into public.verification_requests (id, organization_id, status, decided_at, expires_on, decision_notes)
select ('71000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'approved', now(), (now() + interval '1 year')::date, 'Sample data for staging: not a real verification.'
from sample_provider;
insert into public.verification_items (request_id, organization_id, item_type, reference_number, valid_until, status)
select ('71000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       item, 'SAMPLE-' || lpad(n::text, 4, '0'), (now() + interval '1 year')::date, 'verified'
from sample_provider cross join unnest(array['business_registration', 'mayors_permit']) as item;

commit;
