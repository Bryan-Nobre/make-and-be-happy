# Notas para agentes

- Evite reescrever histórico Git já publicado (force push, rebase/amend/squash de commits já enviados). Isso apaga o histórico compartilhado da branch.
- Mantenha a branch em estado utilizável: commits e pushes devem deixar o projeto buildando.
- Segredos nunca vão em `VITE_*` nem no frontend. Autorização e regras de negócio ficam no backend/RLS.
