-- Numeração operacional das sessões de caixa (Caixa #1, #2...).
-- Fica sozinha porque um valor novo de enum só pode ser usado depois
-- que a transação que o criou termina.
alter type public.tipo_sequencia add value if not exists 'CAIXA';
