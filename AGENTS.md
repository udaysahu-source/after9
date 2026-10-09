<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Profiles are visible to others only through security-definer functions (discover_feed, my_matches); profiles table RLS is owner-only — keeps private fields (birth date, preferences) hidden.
- Profile verification status is written only by the server-side AI check (verify.functions.ts) via the admin client; a DB trigger blocks users from setting it and resets it to pending when name/prompt/photo change.
