import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BooksProvider, useBooks } from "@/contexts/BooksContext";
import { AppShell } from "@/components/design/AppShell";
import { AddBookDialog } from "@/components/design/AddBookDialog";

export interface OutletCtx {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openAddBookDialog: () => void;
  today: string;
}

function LayoutInner() {
  const navigate = useNavigate();
  const { addBook } = useBooks();
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const ctx: OutletCtx = {
    searchQuery,
    setSearchQuery,
    openAddBookDialog: () => setAddOpen(true),
    today,
  };

  return (
    <AppShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAddBook={() => setAddOpen(true)}
    >
      <Outlet context={ctx} />
      <AddBookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        today={today}
        onSubmit={async (book) => {
          const created = await addBook(book);
          setAddOpen(false);
          navigate(`/book/${created.id}`);
        }}
      />
    </AppShell>
  );
}

export default function AppLayout() {
  return (
    <BooksProvider>
      <LayoutInner />
    </BooksProvider>
  );
}
