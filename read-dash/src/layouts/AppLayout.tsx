import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BooksProvider, useBooks } from "@/contexts/BooksContext";
import { AppShell } from "@/components/design/AppShell";
import { AddBookDialog } from "@/components/design/AddBookDialog";

export interface OutletCtx {
  openAddBookDialog: (mediaType?: "book" | "game") => void;
  today: string;
}

function LayoutInner() {
  const navigate = useNavigate();
  const { addBook } = useBooks();
  const [addOpen, setAddOpen] = useState(false);
  const [addMedia, setAddMedia] = useState<"book" | "game">("book");
  const today = new Date().toISOString().slice(0, 10);

  const ctx: OutletCtx = {
    openAddBookDialog: (mediaType = "book") => {
      setAddMedia(mediaType);
      setAddOpen(true);
    },
    today,
  };

  return (
    <AppShell onAddBook={() => { setAddMedia("book"); setAddOpen(true); }}>
      <Outlet context={ctx} />
      <AddBookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        today={today}
        defaultMediaType={addMedia}
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
