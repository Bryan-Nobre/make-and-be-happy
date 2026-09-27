import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
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
import { cadastrar } from "@/services/auth";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>): { convite?: string } => {
    const convite = search["convite"];
    return typeof convite === "string" && convite !== "" ? { convite } : {};
  },
  head: () => ({
    meta: [
      { title: "Criar conta — ARVON FOOD" },
      { name: "description", content: "Crie a sua conta para gerenciar o seu restaurante." },
    ],
  }),
  component: Cadastro,
});

const esquema = z
  .object({
    email: z.string().min(1, "Informe o seu e-mail.").email("Informe um e-mail válido."),
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha."),
  })
  .refine((valores) => valores.senha === valores.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não são iguais.",
  });

type Formulario = z.infer<typeof esquema>;

function Cadastro() {
  const { convite } = Route.useSearch();
  const navigate = useNavigate();
  const { usuario, carregando } = useAuth();
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  const form = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", senha: "", confirmacao: "" },
  });

  useEffect(() => {
    if (carregando || !usuario) return;

    if (convite) {
      void navigate({ to: "/aceitar-convite", search: { token: convite }, replace: true });
      return;
    }

    void navigate({ to: "/onboarding", replace: true });
  }, [carregando, usuario, convite, navigate]);

  const enviar = form.handleSubmit(async (valores) => {
    try {
      const comSessao = await cadastrar(valores.email, valores.senha);
      if (!comSessao) setAguardandoConfirmacao(true);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  });

  if (aguardandoConfirmacao) {
    return (
      <AuthShell
        titulo="Confirme o seu e-mail"
        descricao="Enviamos um link de confirmação. Abra o e-mail para ativar a sua conta e depois entre."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
            <MailCheck className="size-5 text-primary" aria-hidden="true" />
          </span>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/login" search={{ convite }}>
              Ir para o login
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar conta"
      descricao={
        convite
          ? "Crie a sua conta para aceitar o convite da equipe."
          : "Crie a sua conta para cadastrar o seu restaurante."
      }
      rodape={
        <>
          Já tem conta?{" "}
          <Link
            to="/login"
            search={{ convite }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="voce@restaurante.com.br"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                {convite && (
                  <FormDescription>
                    Use o mesmo e-mail em que você recebeu o convite.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repetir senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Criando…" : "Criar conta"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
