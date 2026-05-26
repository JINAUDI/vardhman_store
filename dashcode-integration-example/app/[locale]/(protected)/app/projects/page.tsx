
import { redirect } from '@/components/navigation'

const ProjectPage = () => {
  redirect({ href: '/app/projects/grid', locale: 'en' })
  return null
}

export default ProjectPage