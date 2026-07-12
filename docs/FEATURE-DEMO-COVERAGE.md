# Feature Demo Coverage

`npm run seed:feature-demos` creates publish-ready demo content using stable
`demo-` slugs and ids. Re-running it replaces only its own demo records.

The seed also generates stable generic solid-color placeholder photos
(`demo-feature-photo-*`) with real responsive variants, so the demo set does not
depend on uploaded photography while still exercising image aspect ratios,
gallery flow, lightboxes, proofing, and map/gallery references.

## Public Pages

| Demo page                         | Coverage                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/demo-features`                  | Demo hub, category index, location index, menu links, page/galleries/taxonomy entry points                                                                             |
| `/demo-home-editorial-studio`     | Homepage concept for editorial/portrait studios: full-width slider, portfolio stories, Tora justified gallery, testimonials, pricing slider, contact form              |
| `/demo-home-wedding-stories`      | Homepage concept for weddings: wedding hero, creative info block, wedding portfolio, cinematic gallery, classic pricing, FAQ, contact                                  |
| `/demo-home-commercial-brand`     | Homepage concept for commercial work: agency hero, client wall, case studies, commercial gallery, crew section, media pricing, CTA                                     |
| `/demo-home-travel-locations`     | Homepage concept for destination/location work: full-wall hero, route-planning map, scroll layout, location gallery, location index, contact                           |
| `/demo-home-proofing-client`      | Homepage concept for client proofing: proofing links, tabs process block, uniform gallery, testimonials, FAQ, support contact                                          |
| `/demo-home-fine-art-shop`        | Homepage concept for fine-art print sales: minimal slider, props catalog gallery, shop grid/preview, book slider, Instagram, CTA                                       |
| `/demo-home-senior-portraits`     | Homepage concept for senior portraits: modern hero, feature carousel, image comparison, simple pricing, testimonials, split contact                                    |
| `/demo-home-event-coverage`       | Homepage concept for events: documentary hero, filmstrip event gallery, process accordion, team cards, modern pricing, CTA                                             |
| `/demo-home-family-newborn`       | Homepage concept for family/newborn sessions: split hero, about block, justified gallery, testimonials, creative pricing, FAQ, contact                                 |
| `/demo-home-fashion-casting`      | Homepage concept for fashion/casting: creative dark hero, casting about block, models masonry, orbit team, casting services pricing, contact info                      |
| `/demo-hero-banner-layouts`       | Every Banner layout, overlay mode, slider slides, minimal slider autoplay, full-width slider accent/dim options, all banner effects                                    |
| `/demo-content-typography`        | Heading styles, heading levels, fonts, subheading, rich text sizes, image width/rounding, quote, columns, spacer variants, divider variants, custom link layouts       |
| `/demo-info-block-styles`         | Info block styles, creative split/reference positions, photo size, photo ratio, dim/no-dim, info-list text position, tabs, accordion                                   |
| `/demo-portfolio-list-styles`     | Every Portfolio list style, hover images, background/text/accent colors                                                                                                |
| `/demo-about-profile-styles`      | Every About layout, profile photos, contact fields, press/awards/collaborators, optional contact form                                                                  |
| `/demo-media-interaction-tools`   | Image comparison orientations/aspect ratios/widths, feature carousel counts/radius/autoplay/arrows, book slider sizes/page styles, WebGL distortion, cinematic gallery |
| `/demo-gallery-block-grids`       | Every Page Builder Gallery grid type, source modes, spacing, carousel autoplay, 3D backdrop, Tora props catalog, Tora justified showcase controls                      |
| `/demo-gallery-filter-systems`    | Filter tabs by category/location/custom, flip reveal and Tora portfolio masonry, overlay text, sort modes, manual order, pagination/separator sizing                   |
| `/demo-scroll-showcase-core`      | Scroll showcase cinematic and carousel3d styles                                                                                                                        |
| `/demo-scroll-panels-variants`    | Scroll panel variants, intro count, row count, tone, align, background/text colors                                                                                     |
| `/demo-layout-formation-variants` | Layout formation variants, header align, photo count                                                                                                                   |
| `/demo-scroll-layout-variants`    | Scroll layout variants, photo count, background/text controls, caption                                                                                                 |
| `/demo-proof-team-logos-faq`      | Testimonials layouts, team layouts, logo styles, logo size/spacing/grayscale, FAQ styles, proofing links                                                               |
| `/demo-pricing-styles`            | Every Pricing style, billing toggle/frequency, theme, slider background/overlay/autoplay/timing/text sizes, media photos, casting ratio                                |
| `/demo-contact-styles`            | Every Contact form style, Tora contact info, Tora images with form, reference contact hero, socials, image rows                                                        |
| `/demo-commerce-conversion`       | Shop grid, coming-soon shop, sidebar/search/tags/sort/sale/prices, CTA button styles, Instagram feed                                                                   |
| `/demo-maps-taxonomy`             | Category/location indexes, location map modes, map themes, markers, labels, controls, custom pins, network, route planning                                             |

## Public Galleries

The seed creates public galleries for these Gallery-tab layout families:

- Masonry, justified, and uniform.
- Horizontal Lenis with minimal, editorial, and centered overlays.
- Parallax ring and CSS glitch.
- Image trail variants: fade-shrink, zoom-fade, drop, scatter, stretch-drop, full-frame.
- Rotating scroll variants: demo1, demo2, demo3, demo4, demo5.
- Diagonal slideshow: dark, light, and minimal option sets.
- Depth gallery label styles: color-chip, metadata, minimal; plus slow/normal/fast scroll speed and mood/trail/particle toggles.
- Infinite canvas density/size/movement/control combinations.
- Palmer draggable density/size/detail/custom-color combinations.
- Tora sliphover label sources: auto, headline, alt, caption.
- Tora justified showcase title sources: auto, headline, alt, caption; plus background, title/accent color, gutters, hover inset, dimming, scroll-on-select, and blurred side-fill options.
- Alternative scroll with dark text-enabled and plain image-first variants.

The seed also creates a private proofing gallery and prints a fresh share link
after each run, so favorites and downloads can be checked without exposing the
raw token in committed files.

## Categories, Locations, And Design

- Demo categories: Editorial Portraits, Event Stories, Nature Landscapes,
  Wedding Details, Commercial Sets.
- Demo locations: Chicago Studio, Denver Highlands, Seattle Waterfront,
  Arkansas Trails, New York Editorial.
- Non-default Design tab configs are seeded for home, about, category, location,
  global login/footer, and each demo gallery. Live defaults are not changed.
