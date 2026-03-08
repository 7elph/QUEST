import { CreateMissionForm } from "@/components/app/create-mission-form";

export default function CreateMissionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-amber-200">Nova Missao</h1>
      <p className="text-sm text-amber-100/80">Preencha em 5 passos simples.</p>
      <CreateMissionForm />
    </div>
  );
}
