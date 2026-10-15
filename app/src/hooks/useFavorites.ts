import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { listFavoriteIds, setFavorite } from "../lib/recipes";

export function useFavorites() {
  const { member } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["favorites"], queryFn: listFavoriteIds });
  const ids = data ?? new Set<string>();

  const mutation = useMutation({
    mutationFn: ({ recipeId, on }: { recipeId: string; on: boolean }) => setFavorite(member!.id, recipeId, on),
    onMutate: async ({ recipeId, on }) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<Set<string>>(["favorites"]);
      const next = new Set(prev);
      on ? next.add(recipeId) : next.delete(recipeId);
      qc.setQueryData(["favorites"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["favorites"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  return { ids, toggle: (recipeId: string) => mutation.mutate({ recipeId, on: !ids.has(recipeId) }) };
}
