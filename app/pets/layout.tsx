import PetNav from '@/components/pets/PetNav'

export default function PetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0718]">
      <PetNav />
      {children}
    </div>
  )
}
