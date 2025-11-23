'use client';

import Link from 'next/link';

const lastUpdated = 'November 13, 2025';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: [
      'Rekindle is a photo restoration and enhancement platform that lets you preserve family memories using AI-driven tooling, cross-device uploads, and human-in-the-loop workflows. By accessing or using Rekindle, you agree to these Terms of Use and our Privacy Policy.',
      'If you are using Rekindle on behalf of another person or organization, you represent that you have authority to bind them and that they also accept these Terms.',
    ],
  },
  {
    title: '2. Accounts & Eligibility',
    content: [
      'You must be at least 16 years old (or the equivalent minimum age in your jurisdiction) to create a Rekindle account. You are responsible for maintaining the confidentiality of your Supabase-provided credentials, access tokens, and any biometric or cross-device session codes generated through the service.',
      'You must provide accurate, up-to-date information during onboarding. We may suspend or terminate accounts that contain false information, violate these Terms, or are used for prohibited activities.',
    ],
  },
  {
    title: '3. Permitted Use',
    content: [
      'Rekindle is designed solely for restoring, enhancing, storing, and sharing personal or family photographs. Commercial use (e.g., providing restoration services to clients) requires our prior written consent.',
      'You agree not to use Rekindle to infringe on the rights of others, including uploading images that you do not have permission to process, or that violate intellectual property, privacy, or publicity rights.',
      'You will not attempt to reverse engineer, decompile, or otherwise extract source code from Rekindle services, including any Supabase APIs or infrastructure we provide.',
    ],
  },
  {
    title: '4. Content Ownership',
    content: [
      'You retain ownership of all photos and related metadata that you upload to Rekindle. By using the service, you grant Rekindle a limited, revocable, non-exclusive license to host, process, and deliver your content solely for providing the features you request (such as restoration, colorization, or animation).',
      'We do not claim any rights to sell, license, or publicly distribute your photos. We may, however, produce derived assets (e.g., enhanced photos) on your behalf and store them in your account.',
    ],
  },
  {
    title: '5. User Conduct & Prohibited Content',
    content: [
      'You may not upload or create content that is illegal, hateful, harassing, exploitative, or otherwise violates applicable laws. This includes (but is not limited to) defamatory content, nonconsensual intimate imagery, or content depicting child sexual abuse.',
      'You may not use Rekindle to develop face recognition databases or surveillance tooling. Rekindle is solely for the personal restoration of your own photographic memories.',
      'We reserve the right to remove content and suspend accounts that violate this section or any applicable laws.',
    ],
  },
  {
    title: '6. Credits, Plans, and Fees',
    content: [
      'Certain Rekindle features require credits, which may be allocated monthly by tier or purchased as add-ons. Credits are non-transferable and expire according to the plan details presented in-app.',
      'Subscription fees and credit purchases are billed through our payment processor. All fees are non-refundable unless required by law. We may update pricing at any time with reasonable notice.',
    ],
  },
  {
    title: '7. Cross-Device & Biometric Sessions',
    content: [
      'Rekindle offers cross-device uploads and optional biometric authentication. Temporary sessions and tokens generated through QR codes or WebAuthn are short-lived and device-specific.',
      'You are responsible for safeguarding your devices. If you suspect unauthorized access, revoke sessions via the account settings page and contact support immediately.',
    ],
  },
  {
    title: '8. Storage & Retention',
    content: [
      'Processed assets, uploads, and derived metadata are stored in segmented namespaces per user. We implement safeguards such as Supabase row-level policies and S3 prefix isolation to prevent cross-account access.',
      'We may offer deletion or archival options. Deleting an account will place it in a 30-day grace period before permanent removal, during which you may cancel the deletion request.',
    ],
  },
  {
    title: '9. Third-Party Services',
    content: [
      'Rekindle relies on trusted third parties such as Supabase (authentication, database, storage) and optional social identity providers (e.g., Google). Your use of those services is subject to their respective terms.',
      'We may link to external tutorials or resources. We are not responsible for third-party websites or the content they provide.',
    ],
  },
  {
    title: '10. Limited Warranty & Disclaimers',
    content: [
      'Rekindle is provided “as-is” without warranties of any kind, whether express or implied. We do not guarantee specific restoration outcomes, uninterrupted service, or permanent retention of your data.',
      'To the extent permitted by law, Rekindle and its contributors disclaim liability for indirect, incidental, or consequential damages arising from the use of the service.',
    ],
  },
  {
    title: '11. Limitation of Liability',
    content: [
      'In no event will Rekindle’s total liability exceed the amount you paid for the service in the twelve months preceding the claim. Some jurisdictions do not allow limitations on implied warranties or liability; these limits may not apply to you.',
    ],
  },
  {
    title: '12. Termination',
    content: [
      'You may cancel your Rekindle account at any time through the account settings page. We may suspend or terminate your access if you violate these Terms, misuse the service, or if required by law.',
      'Upon termination, your license to use Rekindle ends. Sections related to intellectual property, disclaimers, limitations of liability, and dispute resolution will survive termination.',
    ],
  },
  {
    title: '13. Updates to These Terms',
    content: [
      'We may update these Terms from time to time to reflect new features, legal requirements, or product changes. We will notify you via email or in-app notice if we make material updates. Continued use of Rekindle after updates constitutes acceptance of the revised Terms.',
    ],
  },
  {
    title: '14. Contact',
    content: [
      'For questions about these Terms or to report a violation, contact our support team at support@rekindle.app.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8 sm:p-12 space-y-12">
        <header className="space-y-4">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
            Legal
          </span>
          <h1 className="text-3xl font-bold text-gray-900">Rekindle Terms of Use</h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
          <p className="text-gray-600">
            Please read these Terms carefully. They describe the rules that govern your use of Rekindle’s
            applications, including our web, mobile, and cross-device experiences.
          </p>
        </header>

        <section className="space-y-10">
          {sections.map((section) => (
            <article key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                {section.content.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <footer className="space-y-3 text-gray-600">
          <p>
            By continuing to use Rekindle, you acknowledge that you have read, understood, and agree to these Terms of
            Use.
          </p>
          <p>
            Need more information? Review our{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 font-medium">
              Privacy Policy
            </Link>{' '}
            to understand how we collect and use data, or{' '}
            <a href="mailto:support@rekindle.app" className="text-blue-600 hover:text-blue-700 font-medium">
              contact support
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}



