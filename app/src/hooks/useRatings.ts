import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { listMyRatings, setRating } from "../lib/recipes";

/** My personal star ratings, with optimistic updates (same pattern as useFavorites). */
export function useRatings() {
  const { member } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ratings"], queryFn: listMyRatings });
  const ratings = data ?? new Map<string, number>();

  const mutation = useMutation({
    mutationFn: ({ recipeId, stars }: { recipeId: string; stars: number | null }) => setRating(member!.id, recipeId, stars),
    onMutate: async ({ recipeId, stars }) => {
      await qc.cancelQueries({ queryKey: ["ratings"] });
      const prev = qc.getQueryData<Map<string, number>>(["ratings"]);
      const next = new Map(prev);
      stars === null ? next.delete(recipeId) : next.set(recipeId, stars);
      qc.setQueryData(["ratings"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["ratings"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["ratings"] });
      qc.invalidateQueries({ queryKey: ["recipes"] }); // the star filter depends on my ratings
    },
  });

  return {
    get: (recipeId: string) => ratings.get(recipeId) ?? null,
    rate: (recipeId: string, stars: number | null) => mutation.mutate({ recipeId, stars }),
  };
}
