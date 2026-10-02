-- Fotos de produto são convertidas para WebP no navegador antes do envio.
-- O bucket passa a recusar qualquer outro tipo declarado.
update storage.buckets
set allowed_mime_types = array['image/webp']
where id = 'produtos';
