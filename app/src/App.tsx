import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { RequireMember } from "./auth/RequireMember";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/LoginPage";

const FeedPage = lazy(() => import("./pages/FeedPage"));
const RecipePage = lazy(() => import("./pages/RecipePage"));
const CookingPage = lazy(() => import("./pages/CookingPage"));
const AddRecipePage = lazy(() => import("./pages/AddRecipePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted" role="status">טוען…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireMember />}>
          <Route path="/recipe/:id/cook" element={<CookingPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<FeedPage key="feed" />} />
            <Route path="/favorites" element={<FeedPage key="favorites" favoritesOnly />} />
            <Route path="/recipe/:id" element={<RecipePage />} />
            <Route path="/add" element={<AddRecipePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
