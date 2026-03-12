# Deployment Hardening

## Backend

- restringir CORS a origins configuradas
- servir apenas por HTTPS em ambientes expostos
- aplicar HSTS quando HTTPS estiver ativo
- separar ambientes por credenciais e configuracao

## Frontend

- headers de seguranca via Next
- CSP restritiva
- nao expor segredos de servidor ao cliente
- preferir API privada ou tunnel seguro para backend local

## Infra e runtime

- principle of least privilege
- logs estruturados e sanitizados
- rollback claro para releases com falha
