import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingScreen } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { sair } from "@/services/auth";
import { criarEmpresaComOwner } from "@/services/empresas";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Cadastrar restaurante — ARVON FOOD" },
      { name: "description", content: "Cadastre o seu restaurante para começar a operar." },
    ],
  }),
  component: Onboarding,
});

const esquema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do restaurante.").max(120, "Nome muito longo."),
  nomeResponsavel: z.string().trim().min(2, "Informe o seu nome.").max(120, "Nome muito longo."),
  telefone: z.string().trim().max(30, "Telefone muito longo.").optional(),
});

type Formulario = z.infer<typeof esquema>;

function Onboarding() {
  const navigate = useNavigate();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { carregando, vinculos, selecionarEmpresa, recarregar } = useEmpresa();

  const form = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: "", nomeResponsavel: "", telefone: "" },
  });

  useEffect(() => {
    if (carregandoAuth || usuario) return;
    void navigate({ to: "/login", replace: true });
  }, [carregandoAuth, usuario, navigate]);

  useEffect(() => {
    if (carregando || vinculos.length === 0) return;
    void navigate({ to: "/", replace: true });
  }, [carregando, vinculos.length, navigate]);

  const enviar = form.handleSubmit(async (valores) => {
    try {
      const empresaId = await criarEmpresaComOwner({
        nome: valores.nome,
        nomeResponsavel: valores.nomeResponsavel,
        telefone: valores.telefone,
      });

      selecionarEmpresa(empresaId);
      recarregar();
      toast.success("Restaurante cadastrado. Bem-vindo ao ARVON FOOD.");
      void navigate({ to: "/", replace: true });
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  });

  if (carregandoAuth || !usuario || carregando) {
    return <LoadingScreen label="Preparando o seu cadastro…" />;
  }

  return (
    <AuthShell
      titulo="Cadastrar restaurante"
      descricao="Estes dados podem ser ajustados depois em Configurações."
      rodape={
        <button
          type="button"
          onClick={() => void sair()}
          className="font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Sair desta conta
        </button>
      }
    >
      <Form {...form}>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do restaurante</FormLabel>
                <FormControl>
                  <Input placeholder="Restaurante Sabor da Casa" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nomeResponsavel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seu nome</FormLabel>
                <FormControl>
                  <Input placeholder="Como a equipe vai te ver" className="h-11" {...field} />
                </FormControl>
                <FormDescription>Você entra como proprietário da operação.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone (opcional)</FormLabel>
                <FormControl>
                  <Input inputMode="tel" placeholder="(11) 3456-7890" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Cadastrando…" : "Criar restaurante"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
