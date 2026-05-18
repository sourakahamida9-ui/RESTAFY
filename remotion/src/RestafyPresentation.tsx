import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type RestafyPresentationProps = {
  demoUrl: string;
  appUrl: string;
  vitrineUrl: string;
};

const COLORS = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  text: '#f5f5f4',
  muted: '#a8a29e',
  accent: '#ea580c',
  accentSoft: 'rgba(234, 88, 12, 0.15)',
  grid: 'rgba(255,255,255,0.04)',
};

const FONT =
  "ui-sans-serif, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

function SceneSlide({
  title,
  subtitle,
  bullets,
  footnote,
}: {
  title: string;
  subtitle?: string;
  bullets: string[];
  footnote?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [28, 0]);
  const listStart = 18;

  return (
    <AbsoluteFill
      style={{
        opacity,
        padding: 100,
        fontFamily: FONT,
        color: COLORS.text,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'relative',
          maxWidth: 1520,
          margin: '0 auto',
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 18px',
            borderRadius: 999,
            background: COLORS.accentSoft,
            color: COLORS.accent,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          RESTAFY
        </div>
        <h1
          style={{
            fontSize: 86,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: 0,
            marginBottom: subtitle ? 20 : 40,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              fontSize: 36,
              color: COLORS.muted,
              margin: 0,
              marginBottom: 48,
              maxWidth: 1200,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </p>
        ) : null}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {bullets.map((line, i) => {
            const t = frame - listStart - i * 8;
            const o = interpolate(t, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
            const x = interpolate(t, [0, 14], [24, 0], { extrapolateRight: 'clamp' });
            return (
              <li
                key={i}
                style={{
                  opacity: o,
                  transform: `translateX(${x}px)`,
                  fontSize: 34,
                  fontWeight: 500,
                  marginBottom: 22,
                  paddingLeft: 52,
                  position: 'relative',
                  lineHeight: 1.35,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 6,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: COLORS.accent,
                  }}
                />
                {line}
              </li>
            );
          })}
        </ul>
        {footnote ? (
          <p
            style={{
              marginTop: 40,
              fontSize: 26,
              color: COLORS.muted,
              maxWidth: 1100,
              lineHeight: 1.4,
            }}
          >
            {footnote}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function CtaEnd({ demoUrl, appUrl, vitrineUrl }: RestafyPresentationProps) {
  const local = useCurrentFrame();
  const o = interpolate(local, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
        fontFamily: FONT,
      }}
    >
      <div style={{ textAlign: 'center', opacity: o, maxWidth: 1400 }}>
        <h2
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: COLORS.text,
            margin: 0,
            marginBottom: 36,
            letterSpacing: '-0.03em',
          }}
        >
          Découvrez la démo Restafy
        </h2>
        <p style={{ fontSize: 38, color: COLORS.muted, marginBottom: 48, lineHeight: 1.4 }}>
          Parcours complets : restaurant, client, billetterie — le meilleur aperçu sur la page dédiée.
        </p>
        <div
          style={{
            background: COLORS.card,
            borderRadius: 28,
            padding: '48px 56px',
            border: `1px solid ${COLORS.grid}`,
            marginBottom: 40,
          }}
        >
          <p
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: COLORS.accent,
              margin: 0,
              marginBottom: 28,
              wordBreak: 'break-all',
            }}
          >
            {demoUrl}
          </p>
          <p style={{ fontSize: 30, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>
            Application : <span style={{ color: COLORS.text, fontWeight: 600 }}>{appUrl}</span>
            <br />
            Vitrine & offre : <span style={{ color: COLORS.text, fontWeight: 600 }}>{vitrineUrl}</span>
          </p>
        </div>
        <p style={{ fontSize: 32, color: COLORS.text, fontWeight: 600 }}>
          RESTAFY — Ne mangez pas. Savourez.
        </p>
      </div>
    </AbsoluteFill>
  );
}

export const RestafyPresentation: React.FC<RestafyPresentationProps> = ({
  demoUrl,
  appUrl,
  vitrineUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const introLogo = spring({ frame, fps, config: { damping: 12 } });
  const introScale = interpolate(introLogo, [0, 1], [0.92, 1]);
  const introOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT }}>
      <Sequence from={0} durationInFrames={150}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            opacity: introOpacity,
          }}
        >
          <div
            style={{
              transform: `scale(${introScale})`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 120,
                fontWeight: 900,
                color: COLORS.text,
                letterSpacing: '-0.04em',
              }}
            >
              RESTAFY<span style={{ color: COLORS.accent }}>.</span>
            </div>
            <p
              style={{
                fontSize: 42,
                color: COLORS.muted,
                marginTop: 32,
                maxWidth: 1000,
                lineHeight: 1.35,
              }}
            >
              La plateforme tout-en-un pour les restaurants et leurs clients — commandes, fidélité,
              billetterie.
            </p>
            <p
              style={{
                marginTop: 48,
                fontSize: 30,
                color: COLORS.accent,
                fontWeight: 700,
              }}
            >
              Bénin · Afrique de l’Ouest · prêt pour la production
            </p>
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={150} durationInFrames={210}>
        <SceneSlide
          title="Pour les restaurants"
          subtitle="Un back-office complet pour opérer au quotidien, du menu au suivi des ventes."
          bullets={[
            'Tableau de bord : commandes, cuisine, statuts en temps réel',
            'Menu, promos, modes de commande (sur place, à emporter, livraison)',
            'Réservations, caisse / POS, équipe et rôles (manager, staff…)',
            'Mobile Money & paiements selon votre configuration',
            'Analytics et réglages — interface pensée pour la prod',
          ]}
          footnote="Onboarding rapide : création restaurant, slug public, vitrine et app alignées sur app.restafy.shop."
        />
      </Sequence>

      <Sequence from={360} durationInFrames={210}>
        <SceneSlide
          title="Pour les clients"
          subtitle="Parcours clair : découvrir un restaurant, commander, suivre, profiter des avantages."
          bullets={[
            'Fiches restaurant & menu en ligne (QR, lien /r/votre-slug)',
            'Panier, commandes, suivi de livraison ou retrait',
            'Fidélité, récompenses, parrainage — quand le resto active l’offre',
            'Événements : découvrir, acheter des billets, retrouver ses billets',
            'Compte, notifications, profil — expérience mobile-first',
          ]}
          footnote="Les parcours sont ceux déjà utilisables en production sur l’application Restafy."
        />
      </Sequence>

      <Sequence from={570} durationInFrames={210}>
        <SceneSlide
          title="Billetterie & événements"
          subtitle="Du marché des événements à la caisse : une chaîne intégrée pour les restaurateurs qui animent leur salle."
          bullets={[
            'Marketplace /events : mise en avant des événements',
            'Fiche événement, checkout, paiement selon configuration',
            'Billets dans « Mes billets » — prêt pour le contrôle à l’entrée',
            'Côté restaurant : pilotage des événements depuis le dashboard',
            'Même écosystème que les commandes : une seule plateforme',
          ]}
          footnote="Idéal pour dîners, concerts, soirées thématiques et offres groupées."
        />
      </Sequence>

      <Sequence from={780} durationInFrames={300}>
        <SceneSlide
          title="Prêt pour la production"
          subtitle="Infrastructure et produit pensés pour monter en charge : auth, données, rôles, super admin."
          bullets={[
            'Hébergement type Vercel + Supabase (PostgreSQL, RLS, Auth)',
            'Espace super admin : restaurants, utilisateurs, finances, monitoring',
            'Demandes partenaires depuis la vitrine — traitement centralisé',
            'Séparation vitrine marketing (restafy.shop) et app (app.restafy.shop)',
            'Évolutions continues : scripts SQL, API serverless, PWA',
          ]}
          footnote="Une base technique solide pour les premiers restaurants pilotes comme pour la montée en charge."
        />
      </Sequence>

      <Sequence from={1080} durationInFrames={270}>
        <CtaEnd demoUrl={demoUrl} appUrl={appUrl} vitrineUrl={vitrineUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
