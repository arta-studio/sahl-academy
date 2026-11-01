-- منصة سهل ستور: الجداول والصلاحيات
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select approved or is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, is_admin, approved)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    lower(new.email) in (select lower(email) from public.admin_emails),
    lower(new.email) in (select lower(email) from public.admin_emails)
  ) on conflict (id) do nothing;
  return new;
end $$;

create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "admin updates" on public.profiles;
create policy "admin updates" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin deletes" on public.profiles;
create policy "admin deletes" on public.profiles for delete using (public.is_admin());

-- محتوى الكورس: العناوين ظاهرة للجميع، الفيديو والملحقات للمفعّلين فقط
create table if not exists public.lessons (
  id text primary key,
  unit int not null,
  ord int not null,
  unit_title text,
  title text not null,
  summary text,
  minutes numeric,
  kind text default 'شرح',
  free_preview boolean not null default false,
  published boolean not null default true
);
alter table public.lessons enable row level security;
drop policy if exists "lessons readable" on public.lessons;
create policy "lessons readable" on public.lessons for select using (published or public.is_admin());
drop policy if exists "lessons admin" on public.lessons;
create policy "lessons admin" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.lesson_media (
  lesson_id text primary key references public.lessons(id) on delete cascade,
  video_path text,
  attachments jsonb not null default '[]'::jsonb
);
alter table public.lesson_media enable row level security;
drop policy if exists "media for members" on public.lesson_media;
create policy "media for members" on public.lesson_media for select using (
  public.is_approved() or exists (select 1 from public.lessons l where l.id = lesson_id and l.free_preview));
drop policy if exists "media admin" on public.lesson_media;
create policy "media admin" on public.lesson_media for all using (public.is_admin()) with check (public.is_admin());

-- تقدّم المشترك
create table if not exists public.progress (
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text references public.lessons(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.progress enable row level security;
drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- التخزين: حاوية خاصة للفيديوهات والملحقات
insert into storage.buckets (id, name, public) values ('course', 'course', false)
  on conflict (id) do nothing;
drop policy if exists "course read members" on storage.objects;
create policy "course read members" on storage.objects for select using (
  bucket_id = 'course' and (public.is_approved() or (storage.foldername(name))[1] = 'preview'));
drop policy if exists "course admin write" on storage.objects;
create policy "course admin write" on storage.objects for insert with check (bucket_id = 'course' and public.is_admin());
drop policy if exists "course admin update" on storage.objects;
create policy "course admin update" on storage.objects for update using (bucket_id = 'course' and public.is_admin());
drop policy if exists "course admin delete" on storage.objects;
create policy "course admin delete" on storage.objects for delete using (bucket_id = 'course' and public.is_admin());

-- الأدمن
insert into public.admin_emails (email) values ('algolanda77@gmail.com') on conflict do nothing;

-- دروس الوحدة 1
insert into public.lessons (id, unit, ord, unit_title, title, summary, minutes, kind, free_preview) values
 ('1-1', 1, 1, 'لماذا نحوّل المنهج إلى لعبة؟', 'التعلم باللعب: الفكرة وما ستبنيه', 'ليش اللعب يثبّت المعلومة، والخطوات الأربع من الدرس إلى اللعبة، وخريطة الكورس.', 2, 'شرح', true),
 ('1-2', 1, 2, 'لماذا نحوّل المنهج إلى لعبة؟', 'أنواع الألعاب التعليمية', 'خمسة أنواع: الاختبار، المطابقة، الرحلة، المحاكاة، والترتيب، ومتى تستخدم كل نوع.', 3, 'شرح', false),
 ('1-3', 1, 3, 'لماذا نحوّل المنهج إلى لعبة؟', 'جولة عملية في «مغامرة قطرة الماء»', 'نلعب اللعبة خطوة بخطوة ونشوف كيف تحوّل درس دورة الماء إلى تجربة تفاعلية.', 3, 'تطبيق عملي', false)
on conflict (id) do update set title = excluded.title, summary = excluded.summary, minutes = excluded.minutes, kind = excluded.kind, free_preview = excluded.free_preview, unit_title = excluded.unit_title;
