import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useEstoqueMutations } from "@/hooks/use-estoque";
import { novoUuid } from "@/lib/uuid";
import {
  UNIDADE_NOME,
  type ItemEstoque,
  type UnidadeEstoque,
} from "@/services/estoque";

const UNIDADES = Object.keys(UNIDADE_NOME) as UnidadeEstoque[];

type Props = {
  codigo: string | null;
  onFechar: () => void;
  onCriado: (item: ItemEstoque) => void;
};

/** Cadastro mínimo quando a primeira bipagem encontra um código inexistente. */
export function DialogoCadastroRapidoInsumo({ codigo, onFechar, onCriado }: Props) {
  const { criar } = useEstoqueMutations();
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState<UnidadeEstoque>("UN");
  const [minimo, setMinimo] = useState(0);
  const [categoria, setCategoria] = useState("");
  const [requisicaoId, setRequisicaoId] = useState(() => novoUuid());

  const aberto = !!codigo;
  const valido = nome.trim().length >= 2 && minimo >= 0;

  useEffect(() => {
    if (!codigo) return;
    setNome("");
    setCategoria("");
    setMinimo(0);
    setUnidade("UN");
    setRequisicaoId(novoUuid());
  }, [codigo]);

  const salvar = () => {
    if (!codigo || !valido) return;
    criar.mutate(
      {
        nome: nome.trim(),
        codigo,
        categoria: categoria.trim(),
        unidade,
        quantidadeMinima: minimo,
        saldoInicial: 0,
        requisicaoId,
      },
      {
        onSuccess: (id) => {
          onCriado({
            id,
            codigo,
            nome: nome.trim(),
            categoria: categoria.trim(),
            unidade,
            quantidade: 0,
            quantidadeMinima: minimo,
            ativo: true,
            status: "SEM_ESTOQUE",
          });
          setNome("");
          setCategoria("");
          setMinimo(0);
          setUnidade("UN");
          onFechar();
        },
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar insumo</DialogTitle>
          <DialogDescription>
            Código <span className="font-mono font-medium text-foreground">{codigo}</span> ainda
            não existe. Cadastre para incluir na lista de bipagem (o saldo só muda ao confirmar).
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-cadastro-rapido-insumo"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rapido-nome">Nome</Label>
            <Input
              id="rapido-nome"
              value={nome}
              maxLength={120}
              autoFocus
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rapido-unidade">Unidade</Label>
            <NativeSelect
              id="rapido-unidade"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as UnidadeEstoque)}
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {UNIDADE_NOME[u]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rapido-minimo">Estoque mínimo</Label>
            <Input
              id="rapido-minimo"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={minimo === 0 ? "" : minimo}
              placeholder="0"
              onChange={(e) => setMinimo(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rapido-cat">Categoria (opcional)</Label>
            <Input
              id="rapido-cat"
              value={categoria}
              maxLength={60}
              placeholder="Ex.: Bebidas"
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-cadastro-rapido-insumo"
            disabled={!valido || criar.isPending}
          >
            {criar.isPending ? "Salvando…" : "Cadastrar e bipar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
