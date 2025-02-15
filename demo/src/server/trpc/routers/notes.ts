
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { db, notes } from '../../../db';
import { eq } from 'drizzle-orm';

export const noteRouter = router({
  create: publicProcedure
    .input(
      z.object({
        note: z.string(),
        person: z.string()
      })
    )
    .mutation(
      async ({ input }) => await db.insert(notes).values({ note: input.note, person: input.person }).returning()
    ),
  list: publicProcedure.input(
    z.object({person: z.string()})
  ).query(async ({input}) => {
    const selectedNotes = await db.select().from(notes).where(eq(notes.person, input.person));
    return selectedNotes.map((note) => ({ ...note, id: +note.id }));
  }),
  remove: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => await db.delete(notes).where(eq(notes.id, input.id)).returning()),
});