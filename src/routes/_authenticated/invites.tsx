import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BottomNav, Shell } from "@/components/after9";
import { useMyProfile } from "@/lib/after9";
import { addInviteContact, ensureInvites, listInviteContacts, markInviteSent, removeInviteContact } from "@/lib/invites.functions";
import { drawInviteCard } from "@/lib/share-cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invites")({
  head: () => ({
    meta: [
      { title: "Invite friends — After9" },
      { name: "description", content: "Keep a list of friends and send each one their own After9 invite code." },
      { property: "og:title", content: "Invite friends — After9" },
      { property: "og:description", content: "Keep a list of friends and send each one their own After9 invite code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InviteList,
});

type Contact = { id: string; name: string; email: string; code: string | null; sent_at: string | null; stage: "saved" | "sent" | "joined" | "setting_up" | "live" };

const STAGE: Record<Contact["stage"], [string, string]> = {
  saved: ["Not sent yet", "text-muted-foreground"],
  sent: ["Invite sent", "text-action"],
  joined: ["Signed up · setting up", "text-action"],
  setting_up: ["Finished setup · checking", "text-action"],
  live: ["Live on After9", "text-teal"],
};

function InviteList() {
  const { p } = useMyProfile();
  const ensure = useServerFn(ensureInvites);
  const list = useServerFn(listInviteContacts);
  const add = useServerFn(addInviteContact);
  const sent = useServerFn(markInviteSent);
  const remove = useServerFn(removeInviteContact);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => list().then((r) => setContacts(r as Contact[]));
  useEffect(() => {
    ensure().then(load);
  }, [ensure]);

  if (!p) return <Shell><div /></Shell>;
  const live = contacts.filter((c) => c.stage === "live").length;
  const joined = contacts.filter((c) => c.stage === "joined" || c.stage === "setting_up" || c.stage === "live").length;

  const share = async (c: Contact) => {
    if (!c.code) return;
    const url = `${location.origin}/?invite=${c.code}`;
    const text = `Hi ${c.name}! Join me on After9 — meet on the floor, stay after. ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "After9 invite", text, url }); } catch { return; } }
    else await navigator.clipboard?.writeText(text);
    setCopied(c.id);
    await sent({ data: { id: c.id } });
    load();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNote("");
    const r = await add({ data: { name, email } });
    setBusy(false);
    if (!r.ok) { setNote(r.reason ?? "Couldn't save that friend."); return; }
    setNote("Saved to your crew! Share your personal invite link with them.");
    setName(""); setEmail("");
    load();
  };

  return (
    <Shell maxWidth="wide">
      <main className="flex-1 pb-24 md:pb-28">
        <div className="flex items-end justify-between px-5 pt-6 md:pt-10">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-primary md:text-4xl">Invite list</h1>
            <p className="text-sm text-muted-foreground">Save your friends' emails, give each one a code, and see who joins.</p>
          </div>
          <Link to="/profile" className="text-sm font-semibold text-primary hover:underline">Profile</Link>
        </div>

        <div className="mt-4 md:mt-8 md:grid md:grid-cols-12 md:gap-8 md:px-5">
            <div className="flex flex-col gap-4 md:col-span-5">
              {contacts.length > 0 && (
                <div className="mx-5 md:mx-0 grid grid-cols-3 gap-2 text-center">
                  {[["On the list", contacts.length], ["Joined", joined], ["Live", live]].map(([l, n]) => (
                    <div key={l} className="bg-card py-3 rounded-xs border border-border/40 shadow-2xs">
                      <p className="font-display text-2xl font-extrabold text-primary">{n}</p>
                      <p className="text-xs text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={submit} className="mx-5 md:mx-0 space-y-2 rounded-xs border border-border/60 bg-card p-4 shadow-2xs">
                <p className="text-xs font-semibold tracking-wider uppercase text-action">Add a friend</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend's name" className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-action" />
                <div className="flex gap-2">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="their@email.com" className="h-11 flex-1 border border-border bg-background px-3 outline-none focus:border-action" />
                  <button disabled={busy || !name.trim() || !email.trim()} className="touch-tactile h-11 bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add</button>
                </div>
                {note && <p className="text-sm text-muted-foreground">{note}</p>}
              </form>

              <p className="mx-5 md:mx-0 text-xs text-muted-foreground leading-relaxed">
                "Send invite" copies a message with their personal link — paste it into any chat or email. Friends who join with your code skip the photo check.
              </p>
            </div>

            <div className="mx-5 md:mx-0 md:col-span-7">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold tracking-wider uppercase text-action">Saved contacts</p>
                {contacts.length > 0 && (
                  <span className="text-xs text-muted-foreground">{contacts.length} {contacts.length === 1 ? "friend" : "friends"}</span>
                )}
              </div>
              {contacts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-action/10 text-action">
                    <span className="text-2xl animate-bounce-soft">🎟️</span>
                  </div>
                  <p className="font-display text-base font-bold text-primary">No friends on your list yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Add friends above using their name and email. They'll receive a unique VIP code that lets them join After9 and instantly skip verification.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border/60 bg-card shadow-2xs overflow-hidden">
                  {contacts.map((c) => (
                    <div key={c.id} className="p-4 transition-colors hover:bg-muted/20">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                        </div>
                        <span className={cn("shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/60", STAGE[c.stage][1])}>
                          {STAGE[c.stage][0]}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="font-mono tracking-widest text-xs font-bold text-primary bg-muted/40 px-2 py-1 rounded">
                          {c.code ?? "No code free"}
                        </span>
                        <div className="flex items-center gap-2">
                          {c.stage === "saved" && (
                            <button
                              type="button"
                              className="min-h-[36px] px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive touch-tactile active:scale-95"
                              onClick={async () => { await remove({ data: { id: c.id } }); load(); }}
                            >
                              Remove
                            </button>
                          )}
                          {c.code && (c.stage === "saved" || c.stage === "sent") && (
                            <>
                              <button
                                type="button"
                                className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-action hover:bg-action/10 rounded-md touch-tactile active:scale-95"
                                onClick={() => drawInviteCard(c.code!, `${location.origin}/?invite=${c.code}&src=card`)}
                              >
                                View Card
                              </button>
                              <button
                                type="button"
                                className="min-h-[36px] px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-2xs hover:opacity-90 touch-tactile active:scale-95"
                                onClick={() => share(c)}
                              >
                                {copied === c.id ? "✓ Copied" : c.sent_at ? "Resend" : "Send invite"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </main>
      <BottomNav />
    </Shell>
  );
}
