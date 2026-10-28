-- Cat Go: persist profile cosmetics used by the shop.
alter table public.catgo_players
  add column if not exists avatar_frame_key text not null default 'none'
    check (avatar_frame_key in ('none','gold','rose','neon','cosmic')),
  add column if not exists avatar_accessory_key text not null default 'none'
    check (avatar_accessory_key in ('none','bow','glasses','crown','halo','party')),
  add column if not exists cat_card_style_key text not null default 'classic'
    check (cat_card_style_key in ('classic','rose','mint','night','gold'));

-- Ensure existing rows always have a valid default.
update public.catgo_players
set avatar_frame_key = coalesce(avatar_frame_key, 'none'),
    avatar_accessory_key = coalesce(avatar_accessory_key, 'none'),
    cat_card_style_key = coalesce(cat_card_style_key, 'classic')
where avatar_frame_key is null
   or avatar_accessory_key is null
   or cat_card_style_key is null;
