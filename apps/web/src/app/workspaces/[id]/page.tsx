import { IdeShell } from '@/components/ide/IdeShell'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <IdeShell workspaceId={id} />
}
