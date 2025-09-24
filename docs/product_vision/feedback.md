Virality of the product:

- for MVP, we are considering to have this out of scope.  It's not important yet.  The highest priority is to have a minimal professional product with core features that works well.
- we can add virality and sharing features soon after MVP launch

Sales Strategy:

- we confirmed that we want a tiered strategy (free with three paid tiers) but with options for top-ups from any tier
- our application will use 'credits' as currency
- tiered subscriptions will provide a certain number of credits each month, and top-ups can add additional credits for that month
- top ups should be carried over from month to month, and should probably be a separate currency so we don't mix it with the monthly subscription credits that resets each month
- monthly subscription credits are always used up first, then top-up credits
- we should promote annual billing with 20% discounts to the user

Metrics:

- we need to reduce the metrics down to only the most core/important ones for MVP
- Account metrics:
  - total user accounts
  - user tier distribution
- Financial metrics:
  - average revenue per user (ARPU)
  - profit margin
  - Monthly Recurring Revenue (MRR)
  - Monthly operational costs (infra + ai model costs + other)

  Product:

  - Photo Upload Flow:
    - this will be core workflow in our MVP. Please analyze, and assess if this is feasible, and provide feedback or suggestions if you have any
    - Mobile flow:
      - Landing page (PWA app home page) -> Upload your photo CTA -> Take Photo (mobile camera) -> Pre-upload flow -> Upload -> Post-Upload flow
      - Landing page (PWA app home page) -> Upload your photo CTA -> Choose from Gallery -> select image file -> Pre-upload flow -> Upload -> Post-Upload flow
    - Desktop flow:
      - Landing page (browser) -> Upload your photo CTA -> Take Photo with Phone -> use Mobile device to scan QR code -> use mobile device to take photo -> Pre-upload flow -> Upload -> Post-Upload flow -> see uploaded image on desktop browser
      - Landing page (browser) -> Upload your photo CTA -> Drag and Drop image file or select image file from file system -> Pre-upload flow -> Upload -> Post-upload flow
    - Pre-upload flow:
      - image has been selected (either from gallery or camera capture) and displayed in full -> show rectangular overlay of intended cropping from app, show circular and draggable points around corners and edges of the overlay for the user to drag and adjust cropping as desired -> user clicks Upload button -> detect image file size, down-size as needed (resolution optimization) -> Upload
    - Post-upload flow:
      - persepctive correction (fix skewed angles) -> initial quality enhancements to image to prep for processing-ready state -> save image as the one to use for processing -> create thumbnail of image for performance use -> delete original upload


- AI Features:
  - these features can be performed individually, or in combinations together.  The credit costs should be for when individually selected.  Total cost of an action combines the credit cost of individual features.
  - AI Processing features for MVP:
    - Restoration (costs x credits)
    - Colourization (costs y credits)
  - AI Processing features for post-MVP:
    - Animation (costs z credits)
    - Bring Together (costs w credits) - upload two or more photos, bring people from multiple photos together into one

- Sharing (Not for MVP):
  - We want to be able to share our results to other platforms, and when we implement this with the virality strategy, we'll give back some credits when the user shares more
  - We also want to be listed as an app when the user wants to share an image from other platforms, this could be another way for the user to get their photos into our app

Architecture:

- PWA app
- If needed, we'll build mobile apps later (easier payment processing for users)

- AI models to use
  - For Restoration and Colourization:
    - Primary: Qwen 3 Image Edit
  - For Animation:
    - Primary: Wan 2.2 T2V A14B
    - Processing: 720p max, 480p for free users
  - For Bring Together:
    - Primary: Qwen 3 Image Edit 2509

- We will use Runpod
- We want to use docker containers while developing locally with hot reloads for a better development experience
- We also want a lean CICD pipeline that runs our unit and integration tests with the use of docker images for quicker and more robust pipeline setup and execution.
- We want every feature to have good unit, integration, and error handling test coverage.  We don't need E2E tests for now.
- We should have good logging implementations to help debug issues
- We should have good API standards and documentation to support possible integrations and headless mode

- Observability
  - we should keep this to the minimal as possible for MVP
  - we don't want to spend anything yet at this point for observability, so possibly we can go without

- Authentication
  - we'll just use email/password for now