import { NovaJornadaForm } from './nova-jornada-form'

export default function NovaJornadaPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Jornada</h1>
        <p className="text-gray-500 text-sm mt-1">As pausas NR-17 (2×10min + 20min refeição) são adicionadas automaticamente para call center.</p>
      </div>
      <NovaJornadaForm />
    </div>
  )
}
