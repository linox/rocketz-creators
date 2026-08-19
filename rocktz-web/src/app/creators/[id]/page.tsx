import { AuthenticatedShell, ComingSoon, requireUser } from "@/components/AuthenticatedShell";

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const title = user.role === "creator" ? "Portal do Criador" : "Perfil do Criador";

  return (
    <AuthenticatedShell>
      <ComingSoon title={title} description={`Perfil #${id}. Abas de portfólio, campanhas e mídia kit entram nas próximas fases.`} />
    </AuthenticatedShell>
  );
}
