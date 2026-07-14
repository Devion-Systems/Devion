export function useProjects(orgId: string) {
  return useQuery({
    queryKey: ['orgs', orgId, 'projects'],   // orgId IMMER im Key
    queryFn: () => client.api.orgs[':orgId'].projects.$get({ param: { orgId } }),
  })
}