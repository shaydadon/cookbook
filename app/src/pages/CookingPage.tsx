import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { CookingMode } from "../components/CookingMode";
import { getRecipe } from "../lib/recipes";

export default function CookingPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const recipe = useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id) });

  if (recipe.isPending) return <p role="status" className="p-8 text-center text-muted">טוען…</p>;
  if (recipe.isError) {
    if ((recipe.error as { code?: string } | null)?.code === "PGRST116") {
      return <p role="alert" className="p-8 text-center text-red-700">המתכון לא נמצא.</p>;
    }
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center text-red-700">
        <p>לא הצלחנו לטעון את המתכון</p>
        <button type="button" onClick={() => recipe.refetch()} className="min-h-11 rounded-full bg-accent px-6 font-medium text-white">
          נסו שוב
        </button>
      </div>
    );
  }
  const data = recipe.data;
  if (data.steps.length === 0) return <p role="alert" className="p-8 text-center">אין שלבים למתכון הזה.</p>;
  return <CookingMode title={data.title ?? ""} steps={data.steps} ingredients={data.ingredients} onExit={() => navigate(`/recipe/${id}`)} />;
}
