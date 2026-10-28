import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { RECIPE_IMAGE_BUCKET } from '@/lib/recipe-images';

/**
 * Deletes the signed-in user's account: their photos in Storage, then the auth
 * user, which cascades to every table (feedback keeps its text without the user).
 */
export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const storage = admin.storage.from(RECIPE_IMAGE_BUCKET);

    // Photos live under "<user id>/"; list() returns at most `limit` per call.
    for (;;) {
      const { data: files, error } = await storage.list(user.id, { limit: 1000 });
      if (error) throw error;
      if (!files || files.length === 0) break;
      const { error: removeError } = await storage.remove(files.map((file) => `${user.id}/${file.name}`));
      if (removeError) throw removeError;
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (error) {
    console.error('Account deletion failed', error);
    return NextResponse.json({ error: 'Konto konnte nicht gelöscht werden' }, { status: 500 });
  }

  // The session belongs to a user that no longer exists; drop its cookies.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
