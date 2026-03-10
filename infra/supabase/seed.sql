insert into public.aura_projects (name, path, description, commands, source)
values (
  'aura_v1',
  '/Users/user_pc/Projetos/aura_v1',
  'Workspace principal da Aura.',
  '{"dev":"pnpm dev","build":"pnpm build"}'::jsonb,
  'seed'
)
on conflict (name) do update
set
  path = excluded.path,
  description = excluded.description,
  commands = excluded.commands,
  source = excluded.source;

insert into public.aura_settings (key, value_json)
values
  ('theme', '"dark"'::jsonb),
  ('default_language', '"pt-BR"'::jsonb),
  ('project_root', '"/Users/user_pc/Projetos"'::jsonb)
on conflict (key) do update
set value_json = excluded.value_json;

