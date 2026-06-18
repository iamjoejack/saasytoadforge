import { describe, it, expect } from 'vitest'
import { listSkills, getSkill } from './skills'

describe('forge skills', () => {
  it('includes the SEO and mobile skills', () => {
    expect(getSkill('seo-optimize')?.label).toBe('SEO optimizer')
    expect(getSkill('mobile-optimize')?.label).toBe('Mobile optimizer')
  })

  it('looks up a skill by its label, case-insensitively', () => {
    expect(getSkill('SEO optimizer')?.name).toBe('seo-optimize')
    expect(getSkill('mobile optimizer')?.name).toBe('mobile-optimize')
  })

  it('returns undefined for an unknown skill', () => {
    expect(getSkill('nope')).toBeUndefined()
  })

  it('every skill has a unique name and a substantial directive', () => {
    const names = new Set<string>()
    for (const skill of listSkills()) {
      expect(names.has(skill.name), `duplicate skill name ${skill.name}`).toBe(false)
      names.add(skill.name)
      expect(skill.directive.length).toBeGreaterThan(50)
      expect(skill.description.length).toBeGreaterThan(0)
      // brand: no em or en dashes in agent-facing copy
      expect(skill.directive.includes('—') || skill.directive.includes('–')).toBe(false)
    }
    expect(listSkills().length).toBeGreaterThanOrEqual(5)
  })
})
