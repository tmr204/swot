// Built-in meal library.
//
// Quantities are for BASE_PORTIONS adult-sized portions (2 adults + 2 small
// children is roughly 3). The shopping list scales them to whoever is eating.
//
// Ingredient lines are plain text ("600g chicken thigh fillets") parsed by
// parseIngredient() in shopping.js, so custom meals use the same format.
// `staples` are cupboard basics (oil, spices, stock cubes) that we list
// separately as "check you have" rather than adding to the basket.
//
// Fields:
//   protein  chicken | steak | salmon | mince | beef | pork | lamb | fish | prawns | veggie | mixed
//   veg      approx. portions of veg/fruit per adult serving
//   kid      generally a hit with young children
//   cheat    a treat / fakeaway night
//   tags     spicy | oily-fish | red-meat | nuts | batch | quick | roast | leftovers
//   leftoverOf  only offered the day after this recipe (extraScale: extra to buy for it)
//   tip      how to make it work for the boys

export const BASE_PORTIONS = 3;

export const RECIPES = [
  // ---------------------------------------------------------------- Chicken
  {
    id: 'chicken-souvlaki', name: 'Chicken souvlaki, pittas & tzatziki', cuisine: 'Greek',
    protein: 'chicken', time: 30, kid: true, veg: 2, tags: [],
    tip: 'Slide the chicken off the skewers and let them build their own pittas.',
    ingredients: ['600g chicken thigh fillets', '6 pitta breads', '250g Greek yoghurt', '1 cucumber',
      '250g cherry tomatoes', '1 red onion', '100g feta', '1 lemon', '2 cloves garlic'],
    staples: ['olive oil', 'dried oregano'],
    method: [
      'Cube the chicken and marinate with oil, lemon juice, oregano and 1 crushed garlic clove (10 min is fine).',
      'Grate half the cucumber, squeeze out the water and mix into the yoghurt with the other garlic clove for tzatziki.',
      'Thread onto skewers (or don\'t) and grill or griddle for 12–15 min, turning, until cooked through.',
      'Chop the tomatoes, remaining cucumber, onion and feta into a quick Greek salad. Warm the pittas and serve.'],
  },
  {
    id: 'chicken-tikka-masala', name: 'Chicken tikka masala with rice & naan', cuisine: 'Indian',
    protein: 'chicken', time: 40, kid: true, veg: 1, tags: [],
    tip: 'Tikka masala is mild — stir a spoon of yoghurt into their portions to cool it further.',
    ingredients: ['600g chicken breast', '150g natural yoghurt', '3 tbsp tikka curry paste', '1 tin chopped tomatoes',
      '150ml double cream', '1 onion', '3 cloves garlic', '300g basmati rice', '4 naan breads'],
    staples: ['vegetable oil', 'garam masala'],
    method: [
      'Mix the chicken (in chunks) with half the yoghurt and 1 tbsp paste; leave while you start the sauce.',
      'Soften the chopped onion in oil for 8 min, add garlic and remaining paste for 1 min, then tomatoes. Simmer 10 min.',
      'Grill or pan-fry the chicken until charred, add to the sauce with the cream and simmer 5 min. Finish with garam masala.',
      'Serve with rice and warm naan.'],
  },
  {
    id: 'chicken-fajitas', name: 'Chicken fajitas', cuisine: 'Mexican',
    protein: 'chicken', time: 25, kid: true, veg: 2, tags: ['quick'],
    tip: 'Use half the seasoning on their strips, or cook theirs first before adding the rest.',
    ingredients: ['600g chicken breast', '3 peppers', '1 red onion', '8 tortilla wraps', '150ml soured cream',
      '100g grated cheddar', '1 lime', '1 avocado', '1 pack fajita seasoning'],
    staples: ['vegetable oil'],
    method: [
      'Slice chicken, peppers and onion into strips and toss with oil and the seasoning.',
      'Stir-fry in a hot pan in batches for 8–10 min until the chicken is cooked and veg is charred.',
      'Mash the avocado with lime juice and a pinch of salt.',
      'Warm the wraps and let everyone build their own with cheese and soured cream.'],
  },
  {
    id: 'thai-green-curry', name: 'Thai green chicken curry', cuisine: 'Thai',
    protein: 'chicken', time: 30, kid: false, veg: 1.5, tags: ['spicy'],
    tip: 'Use half the paste, take the boys\' portion out, then stir more paste into yours.',
    ingredients: ['600g chicken thigh fillets', '3 tbsp Thai green curry paste', '1 tin coconut milk',
      '200g green beans', '1 courgette', '300g jasmine rice', '1 lime'],
    staples: ['vegetable oil', 'fish sauce', 'sugar'],
    method: [
      'Fry the paste in a little oil for 1 min, add the sliced chicken and cook 5 min.',
      'Pour in the coconut milk, bring to a simmer and add the beans and courgette. Cook 10 min.',
      'Season with fish sauce, a pinch of sugar and lime juice.',
      'Serve with jasmine rice.'],
  },
  {
    id: 'chicken-chow-mein', name: 'Chicken chow mein', cuisine: 'Chinese',
    protein: 'chicken', time: 25, kid: true, veg: 2, tags: ['quick'],
    tip: 'Noodles are a guaranteed winner — cut theirs with scissors so they\'re easier to eat.',
    ingredients: ['450g chicken breast', '300g medium egg noodles', '1 red pepper', '200g beansprouts',
      '1 bunch spring onions', '2 carrots', '2 tbsp oyster sauce', '2 cloves garlic'],
    staples: ['soy sauce', 'sesame oil', 'vegetable oil'],
    method: [
      'Cook the noodles, drain and toss with a little sesame oil.',
      'Stir-fry thin strips of chicken in a hot wok for 5 min. Add garlic, sliced pepper and carrot ribbons.',
      'Add the noodles, beansprouts, oyster sauce and 2 tbsp soy. Toss for 2 min.',
      'Scatter with spring onions.'],
  },
  {
    id: 'roast-chicken', name: 'Lemon & herb roast chicken dinner', cuisine: 'British',
    protein: 'chicken', time: 100, kid: true, veg: 2.5, tags: ['roast', 'batch'],
    tip: 'Leftovers make Monday\'s sandwiches or a quick pasta.',
    ingredients: ['1 whole chicken', '1kg potatoes', '4 carrots', '1 broccoli', '1 lemon', '1 bulb garlic'],
    staples: ['olive oil', 'dried thyme', 'gravy granules'],
    method: [
      'Heat oven to 200°C/180°C fan. Stuff the chicken with the halved lemon and garlic, rub with oil and thyme.',
      'Roast for 20 min per 500g plus 20 min, until the juices run clear. Rest 15 min.',
      'Par-boil the potatoes 8 min, rough them up and roast in hot oil for 50 min alongside.',
      'Steam the carrots and broccoli, make gravy with the juices and serve.'],
  },
  {
    id: 'chicken-katsu', name: 'Chicken katsu curry', cuisine: 'Japanese',
    protein: 'chicken', time: 45, kid: true, veg: 1, tags: [],
    tip: 'Crispy chicken with the sauce on the side for dipping.',
    ingredients: ['500g chicken breast', '100g panko breadcrumbs', '2 eggs', '1 onion', '2 carrots',
      '300g sushi rice', '1 cucumber'],
    staples: ['plain flour', 'mild curry powder', 'chicken stock cube', 'honey', 'soy sauce', 'vegetable oil'],
    method: [
      'Sauce: soften chopped onion and carrot in oil 10 min, stir in 2 tbsp curry powder and 1 tbsp flour, then 500ml stock, 1 tbsp honey and 1 tbsp soy. Simmer 15 min, then blend.',
      'Bash the chicken thin, dust in flour, dip in beaten egg then panko.',
      'Shallow fry 3–4 min a side (or oven bake at 200°C for 20 min with a drizzle of oil).',
      'Slice and serve on rice with the sauce and cucumber sticks.'],
  },
  {
    id: 'chicken-cacciatore', name: 'Chicken cacciatore with penne', cuisine: 'Italian',
    protein: 'chicken', time: 50, kid: true, veg: 2, tags: [],
    tip: 'Shred their chicken into the sauce and stir through the pasta.',
    ingredients: ['800g chicken thighs', '1 onion', '2 peppers', '1 tin chopped tomatoes', '3 cloves garlic',
      '300g penne', '40g parmesan'],
    staples: ['olive oil', 'dried oregano', 'tomato purée'],
    method: [
      'Brown the chicken thighs skin-side down for 8 min; set aside.',
      'Soften onion, peppers and garlic for 8 min, stir in 1 tbsp purée, the tomatoes and oregano.',
      'Return the chicken, cover and simmer 30 min.',
      'Serve with penne and parmesan.'],
  },
  {
    id: 'chicken-satay-noodles', name: 'Chicken satay noodles', cuisine: 'Thai',
    protein: 'chicken', time: 25, kid: true, veg: 1.5, tags: ['nuts', 'quick'],
    tip: 'Peanut sauce tends to go down well — leave the chilli out.',
    ingredients: ['500g chicken breast', '4 tbsp peanut butter', '1 tin coconut milk', '300g medium egg noodles',
      '1 red pepper', '150g sugar snap peas', '1 lime'],
    staples: ['soy sauce', 'honey', 'vegetable oil'],
    method: [
      'Whisk the peanut butter, half the coconut milk, 2 tbsp soy, 1 tbsp honey and lime juice into a sauce.',
      'Stir-fry chicken strips 5 min, add pepper and sugar snaps for 3 min.',
      'Add cooked noodles and the sauce; loosen with more coconut milk.'],
  },
  {
    id: 'honey-garlic-traybake', name: 'Honey garlic chicken traybake', cuisine: 'British',
    protein: 'chicken', time: 45, kid: true, veg: 2, tags: [],
    tip: 'Sticky, sweet and one tray — very little washing up.',
    ingredients: ['8 chicken thighs', '800g baby potatoes', '2 red onions', '1 pepper', '200g tenderstem broccoli',
      '4 cloves garlic'],
    staples: ['honey', 'soy sauce', 'olive oil'],
    method: [
      'Heat oven to 200°C/180°C fan. Halve potatoes, wedge onions and pepper, toss with oil.',
      'Mix 3 tbsp honey, 2 tbsp soy and crushed garlic; coat the chicken and nestle on the veg.',
      'Roast 35 min, adding the broccoli for the last 10.'],
  },
  {
    id: 'chicken-shawarma', name: 'Chicken shawarma wraps', cuisine: 'Lebanese',
    protein: 'chicken', time: 30, kid: true, veg: 1.5, tags: [],
    tip: 'Mild spices — let them dip in hummus.',
    ingredients: ['600g chicken thigh fillets', '6 flatbreads', '200g hummus', '1 little gem lettuce',
      '2 tomatoes', '1 cucumber', '150g Greek yoghurt', '1 lemon', '2 cloves garlic'],
    staples: ['ground cumin', 'smoked paprika', 'ground coriander', 'olive oil'],
    method: [
      'Marinate the chicken with oil, lemon, garlic and 1 tsp each spice.',
      'Grill or roast at 220°C for 20 min until charred, then slice.',
      'Warm the flatbreads and fill with chicken, salad, hummus and garlicky yoghurt.'],
  },
  {
    id: 'chicken-pesto-pasta', name: 'Chicken pesto pasta', cuisine: 'Italian',
    protein: 'chicken', time: 20, kid: true, veg: 1, tags: ['quick'],
    tip: 'A dependable weeknight one when one of you is out.',
    ingredients: ['400g chicken breast', '300g fusilli', '6 tbsp green pesto', '200g cherry tomatoes',
      '100g baby spinach', '40g parmesan'],
    staples: ['olive oil'],
    method: [
      'Cook the pasta. Meanwhile pan-fry diced chicken for 8 min.',
      'Add halved tomatoes and spinach until wilted.',
      'Toss everything with the pesto and a splash of pasta water. Top with parmesan.'],
  },
  {
    id: 'chicken-enchiladas', name: 'Chicken enchiladas', cuisine: 'Mexican',
    protein: 'chicken', time: 45, kid: true, veg: 2, tags: ['batch'],
    tip: 'Make a couple without chilli; they love the melted cheese on top.',
    ingredients: ['500g chicken breast', '8 tortilla wraps', '1 tin chopped tomatoes', '1 tin black beans',
      '150g grated cheddar', '1 pepper', '1 onion', '150ml soured cream'],
    staples: ['ground cumin', 'smoked paprika', 'vegetable oil'],
    method: [
      'Fry onion, pepper and diced chicken with 1 tsp each spice for 10 min. Add beans and half the tomatoes.',
      'Roll the filling in tortillas and pack into a dish.',
      'Pour over remaining tomatoes, scatter with cheese and bake at 200°C for 20 min. Serve with soured cream.'],
  },
  {
    id: 'chicken-korma', name: 'Chicken korma with spinach', cuisine: 'Indian',
    protein: 'chicken', time: 35, kid: true, veg: 1, tags: [],
    tip: 'The mildest curry there is — a great introduction for the boys.',
    ingredients: ['600g chicken thigh fillets', '1 onion', '3 cloves garlic', '1 thumb ginger',
      '4 tbsp korma curry paste', '1 tin coconut milk', '100g baby spinach', '300g basmati rice'],
    staples: ['vegetable oil'],
    method: [
      'Soften the onion 8 min, add garlic, ginger and paste for 1 min.',
      'Add chicken pieces and brown, then the coconut milk. Simmer 20 min.',
      'Stir through the spinach and serve with rice.'],
  },
  {
    id: 'jerk-chicken', name: 'Jerk chicken with rice & peas', cuisine: 'Caribbean',
    protein: 'chicken', time: 60, kid: false, veg: 1, tags: ['spicy'],
    tip: 'Brush the boys\' pieces with honey and mild paprika instead of jerk paste.',
    ingredients: ['8 chicken thighs', '3 tbsp jerk paste', '1 tin kidney beans', '1 tin coconut milk',
      '300g long grain rice', '1 bunch spring onions', '2 limes', '2 corn on the cob'],
    staples: ['dried thyme', 'honey', 'vegetable oil'],
    method: [
      'Rub the chicken with jerk paste and lime juice; marinate as long as you can.',
      'Roast at 200°C for 40 min until charred.',
      'Simmer rice with coconut milk, 300ml water, beans, thyme and spring onions until absorbed (~20 min).',
      'Serve with grilled corn and lime wedges.'],
  },
  {
    id: 'greek-chicken-orzo', name: 'One-pot Greek lemon chicken orzo', cuisine: 'Greek',
    protein: 'chicken', time: 40, kid: true, veg: 1, tags: [],
    tip: 'Orzo looks like big rice — usually an easy sell.',
    ingredients: ['600g chicken thigh fillets', '300g orzo', '1 lemon', '100g baby spinach', '100g feta', '1 onion'],
    staples: ['chicken stock cube', 'dried oregano', 'olive oil'],
    method: [
      'Brown the chicken pieces with oregano, then soften the onion in the same pan.',
      'Add orzo, lemon zest and 700ml stock. Simmer 12 min, stirring, until the orzo is tender.',
      'Stir in spinach and lemon juice; crumble over the feta.'],
  },
  {
    id: 'chicken-teriyaki', name: 'Chicken teriyaki rice bowls', cuisine: 'Japanese',
    protein: 'chicken', time: 25, kid: true, veg: 1.5, tags: ['quick'],
    tip: 'Sweet, sticky and they can pick at the edamame.',
    ingredients: ['600g chicken thigh fillets', '4 tbsp teriyaki sauce', '300g sushi rice', '1 broccoli',
      '150g frozen edamame beans'],
    staples: ['sesame seeds', 'vegetable oil'],
    method: [
      'Cook the rice. Fry the chicken in strips for 8 min until golden.',
      'Add the teriyaki sauce and bubble until sticky.',
      'Steam the broccoli and edamame. Serve in bowls with sesame seeds.'],
  },
  {
    id: 'chicken-nuggets', name: 'Homemade chicken nuggets, wedges & corn', cuisine: 'British',
    protein: 'chicken', time: 35, kid: true, veg: 1, tags: ['quick'],
    tip: 'Perfect for a "just me and the boys" night — get them dipping in the egg and crumbs.',
    ingredients: ['500g chicken breast', '100g panko breadcrumbs', '2 eggs', '800g potatoes',
      '4 corn on the cob'],
    staples: ['plain flour', 'smoked paprika', 'olive oil', 'ketchup'],
    method: [
      'Heat oven to 210°C/190°C fan. Cut potatoes into wedges, toss with oil and paprika; roast 30 min.',
      'Cut chicken into nuggets; dust in flour, dip in egg, roll in panko. Bake on an oiled tray for 18 min.',
      'Boil or grill the corn. Serve with ketchup.'],
  },
  {
    id: 'chicken-pho', name: 'Vietnamese chicken pho', cuisine: 'Vietnamese',
    protein: 'chicken', time: 40, kid: true, veg: 1.5, tags: [],
    tip: 'Serve their noodles in a bowl with a little broth; keep the herbs and chilli for the grown-ups.',
    ingredients: ['400g chicken breast', '200g flat rice noodles', '1 onion', '1 thumb ginger', '200g beansprouts',
      '2 pak choi', '1 bunch coriander', '2 limes', '1 red chilli'],
    staples: ['chicken stock cube', 'star anise', 'cinnamon stick', 'fish sauce'],
    method: [
      'Char the halved onion and sliced ginger in a dry pan. Add 1.5 litres stock, 2 star anise and a cinnamon stick; simmer 20 min.',
      'Poach the whole chicken breasts in the broth for 12 min, then shred. Season with fish sauce.',
      'Cook the noodles, divide into bowls with pak choi and beansprouts and ladle over the hot broth and chicken.',
      'Top with coriander, lime and chilli.'],
  },
  {
    id: 'paella', name: 'Chicken, chorizo & prawn paella', cuisine: 'Spanish',
    protein: 'chicken', time: 50, kid: true, veg: 1.5, tags: [],
    tip: 'Pick the prawns out for anyone suspicious — the rice is the star.',
    ingredients: ['400g chicken thigh fillets', '100g chorizo', '150g raw king prawns', '300g paella rice',
      '1 pepper', '150g frozen peas', '1 onion', '1 lemon', '2 cloves garlic'],
    staples: ['smoked paprika', 'turmeric', 'chicken stock cube', 'olive oil'],
    method: [
      'Fry sliced chorizo until it releases its oil, add chicken and brown.',
      'Add onion, pepper and garlic for 5 min, then rice, 1 tsp paprika and ½ tsp turmeric.',
      'Pour in 900ml stock and simmer without stirring for 18 min.',
      'Scatter over prawns and peas, cover for 5 min until pink. Serve with lemon.'],
  },

  // ------------------------------------------------------------------ Steak
  {
    id: 'steak-chips', name: 'Steak, chips & peppercorn sauce', cuisine: 'British',
    protein: 'steak', time: 40, kid: true, veg: 1, tags: ['red-meat'],
    tip: 'Slice the boys\' steak into thin strips; chips and ketchup do the rest.',
    ingredients: ['3 sirloin steaks', '800g Maris Piper potatoes', '150ml double cream', '200g tenderstem broccoli'],
    staples: ['black peppercorns', 'olive oil', 'beef stock cube'],
    method: [
      'Heat oven to 220°C/200°C fan. Cut potatoes into chips, toss in oil and roast 35 min, turning once.',
      'Bring steaks to room temperature, season and fry 2–3 min a side for medium-rare. Rest 5 min.',
      'In the same pan, toast 1 tbsp crushed peppercorns, add 100ml stock and the cream; bubble 3 min.',
      'Serve with the broccoli.'],
  },
  {
    id: 'steak-burrito-bowls', name: 'Steak burrito bowls', cuisine: 'Mexican',
    protein: 'steak', time: 30, kid: true, veg: 2.5, tags: ['red-meat'],
    tip: 'Deconstructed bowls let fussy eaters pick what they want.',
    ingredients: ['500g rump steak', '300g long grain rice', '1 tin black beans', '2 peppers', '1 avocado',
      '1 lime', '150g sweetcorn', '100g grated cheddar', '150ml soured cream'],
    staples: ['ground cumin', 'smoked paprika', 'olive oil'],
    method: [
      'Rub the steak with cumin, paprika and oil. Cook the rice.',
      'Char the sliced peppers and sweetcorn in a hot pan; warm the beans.',
      'Sear the steak 2–3 min a side, rest and slice thinly.',
      'Build bowls with rice, beans, veg, steak, avocado, cheese and soured cream.'],
  },
  {
    id: 'beef-bulgogi', name: 'Korean beef bulgogi with rice', cuisine: 'Korean',
    protein: 'steak', time: 30, kid: true, veg: 1.5, tags: ['red-meat'],
    tip: 'Bulgogi is sweet rather than spicy — keep any gochujang for the adults.',
    ingredients: ['500g sirloin steak', '1 apple', '3 cloves garlic', '1 thumb ginger', '300g jasmine rice',
      '1 cucumber', '2 carrots', '1 bunch spring onions'],
    staples: ['soy sauce', 'brown sugar', 'sesame oil', 'sesame seeds', 'rice vinegar'],
    method: [
      'Slice the steak very thinly (freeze for 20 min first to make it easier).',
      'Grate the apple, garlic and ginger; mix with 4 tbsp soy, 1 tbsp sugar and 1 tbsp sesame oil. Marinate the beef 15+ min.',
      'Quick-pickle the cucumber and carrot ribbons in rice vinegar with a pinch of sugar.',
      'Stir-fry the beef in a very hot pan in batches, 2 min each. Serve on rice with pickles, spring onions and sesame seeds.'],
  },
  {
    id: 'black-bean-beef', name: 'Black bean beef stir-fry', cuisine: 'Chinese',
    protein: 'steak', time: 20, kid: true, veg: 2, tags: ['red-meat', 'quick'],
    tip: 'Noodles over rice for the boys if they prefer.',
    ingredients: ['500g rump steak', '2 peppers', '1 onion', '150g mangetout', '4 tbsp black bean sauce',
      '300g medium egg noodles'],
    staples: ['soy sauce', 'cornflour', 'vegetable oil'],
    method: [
      'Slice the steak thinly and toss with 1 tsp cornflour and 1 tbsp soy.',
      'Stir-fry in a very hot wok for 2 min; remove.',
      'Stir-fry the veg 3 min, return the beef with the black bean sauce and a splash of water.',
      'Toss through the cooked noodles.'],
  },
  {
    id: 'steak-chimichurri', name: 'Steak with chimichurri & crispy potatoes', cuisine: 'Argentinian',
    protein: 'steak', time: 45, kid: true, veg: 1.5, tags: ['red-meat'],
    tip: 'Kids get plain steak strips and potatoes; chimichurri is for the grown-ups.',
    ingredients: ['600g sirloin steaks', '800g baby potatoes', '1 bunch parsley', '1 red chilli', '2 cloves garlic',
      '1 bag mixed salad', '250g cherry tomatoes'],
    staples: ['olive oil', 'red wine vinegar', 'dried oregano'],
    method: [
      'Boil the potatoes 12 min, squash them flat and roast at 220°C with oil for 25 min.',
      'Chimichurri: finely chop parsley, chilli and garlic; mix with 5 tbsp oil, 2 tbsp vinegar and oregano.',
      'Sear the steaks 2–3 min a side and rest. Slice and spoon over the chimichurri.',
      'Serve with salad and tomatoes.'],
  },

  // ----------------------------------------------------------------- Salmon
  {
    id: 'teriyaki-salmon', name: 'Teriyaki salmon noodles', cuisine: 'Japanese',
    protein: 'salmon', time: 20, kid: true, veg: 1.5, tags: ['oily-fish', 'quick'],
    tip: 'Flake their salmon through the noodles so it disappears.',
    ingredients: ['4 salmon fillets', '4 tbsp teriyaki sauce', '300g medium egg noodles', '2 pak choi',
      '150g tenderstem broccoli'],
    staples: ['sesame seeds', 'vegetable oil'],
    method: [
      'Brush the salmon with half the teriyaki and roast at 200°C for 12–14 min.',
      'Cook the noodles; stir-fry the pak choi and broccoli for 3 min.',
      'Toss the noodles and veg with the remaining teriyaki, top with salmon and sesame seeds.'],
  },
  {
    id: 'salmon-pesto-traybake', name: 'Pesto salmon traybake', cuisine: 'Italian',
    protein: 'salmon', time: 35, kid: true, veg: 2, tags: ['oily-fish'],
    tip: 'Pesto crust hides the "fishiness" — usually a hit.',
    ingredients: ['4 salmon fillets', '600g baby potatoes', '250g cherry tomatoes', '200g green beans',
      '3 tbsp green pesto'],
    staples: ['olive oil'],
    method: [
      'Heat oven to 200°C/180°C fan. Roast halved potatoes in oil for 20 min.',
      'Add the beans and tomatoes, sit the salmon on top and spread with pesto.',
      'Roast another 12–15 min until the salmon flakes.'],
  },
  {
    id: 'salmon-tikka', name: 'Salmon tikka with rice & raita', cuisine: 'Indian',
    protein: 'salmon', time: 30, kid: true, veg: 1, tags: ['oily-fish'],
    tip: 'Use a mild paste; raita on the side for dipping.',
    ingredients: ['4 salmon fillets', '2 tbsp tikka curry paste', '150g natural yoghurt', '300g basmati rice',
      '1 cucumber', '1 lemon', '100g baby spinach'],
    staples: ['vegetable oil', 'ground cumin'],
    method: [
      'Coat the salmon in the paste mixed with 2 tbsp yoghurt; marinate 10 min.',
      'Grill or roast at 220°C for 12 min.',
      'Grate the cucumber into the rest of the yoghurt with a pinch of cumin for raita.',
      'Wilt the spinach into the hot rice and serve with lemon wedges.'],
  },
  {
    id: 'salmon-poke-bowls', name: 'Honey-soy salmon rice bowls', cuisine: 'Hawaiian',
    protein: 'salmon', time: 25, kid: true, veg: 2, tags: ['oily-fish', 'quick'],
    tip: 'Let them pick their own toppings — it\'s more fun.',
    ingredients: ['4 salmon fillets', '300g sushi rice', '1 avocado', '1 cucumber', '2 carrots',
      '150g frozen edamame beans'],
    staples: ['soy sauce', 'honey', 'sesame seeds', 'rice vinegar'],
    method: [
      'Cook the rice and season with 1 tbsp rice vinegar.',
      'Glaze the salmon with 2 tbsp each honey and soy; roast at 200°C for 12 min.',
      'Slice the avocado, cucumber and carrot; cook the edamame.',
      'Build bowls and sprinkle with sesame seeds.'],
  },
  {
    id: 'creamy-salmon-pasta', name: 'Creamy salmon & pea pasta', cuisine: 'Italian',
    protein: 'salmon', time: 20, kid: true, veg: 1, tags: ['oily-fish', 'quick'],
    tip: 'Creamy pasta is an easy way to get oily fish into small people.',
    ingredients: ['3 salmon fillets', '300g penne', '150g cream cheese', '150g frozen peas', '1 lemon',
      '100g baby spinach'],
    staples: ['olive oil'],
    method: [
      'Cook the pasta, adding the peas for the last 3 min.',
      'Pan-fry the salmon 4 min a side, then flake.',
      'Stir the cream cheese, lemon zest and juice and spinach into the drained pasta with a splash of water.',
      'Fold in the salmon.'],
  },
  {
    id: 'salmon-sweet-potato', name: 'Lemon salmon, sweet potato wedges & peas', cuisine: 'British',
    protein: 'salmon', time: 35, kid: true, veg: 2, tags: ['oily-fish'],
    tip: 'Sweet potato wedges are a good gateway veg.',
    ingredients: ['4 salmon fillets', '800g sweet potatoes', '200g frozen peas', '1 lemon'],
    staples: ['olive oil', 'smoked paprika', 'butter'],
    method: [
      'Heat oven to 210°C. Toss sweet potato wedges in oil and paprika; roast 30 min.',
      'Add the salmon with lemon slices for the last 12–14 min.',
      'Cook the peas and toss with a knob of butter.'],
  },

  // ------------------------------------------------------------------ Mince
  {
    id: 'spag-bol', name: 'Spaghetti bolognese', cuisine: 'Italian',
    protein: 'mince', time: 50, kid: true, veg: 2, tags: ['red-meat', 'batch'],
    tip: 'Grate the carrot so it melts into the sauce. Double it and freeze half.',
    ingredients: ['500g beef mince', '1 onion', '2 carrots', '2 sticks celery', '2 tins chopped tomatoes',
      '350g spaghetti', '40g parmesan', '2 cloves garlic'],
    staples: ['olive oil', 'tomato purée', 'dried oregano', 'beef stock cube'],
    method: [
      'Soften the finely chopped onion, carrot and celery in oil for 10 min. Add garlic.',
      'Brown the mince, stir in 2 tbsp purée, tomatoes, oregano and a crumbled stock cube.',
      'Simmer at least 30 min (longer is better).',
      'Serve on spaghetti with parmesan.'],
  },
  {
    id: 'chilli-con-carne', name: 'Chilli con carne', cuisine: 'Mexican',
    protein: 'mince', time: 50, kid: true, veg: 2, tags: ['red-meat', 'batch', 'spicy'],
    tip: 'Leave out the chilli powder, take the boys\' portion out, then spice yours up.',
    ingredients: ['500g beef mince', '1 tin kidney beans', '2 tins chopped tomatoes', '1 onion', '1 pepper',
      '300g long grain rice', '150ml soured cream', '100g grated cheddar'],
    staples: ['chilli powder', 'ground cumin', 'smoked paprika', 'beef stock cube', 'vegetable oil'],
    method: [
      'Soften onion and pepper, brown the mince with cumin and paprika.',
      'Add tomatoes, beans and a stock cube; simmer 30 min.',
      'Serve with rice, soured cream and cheese.'],
  },
  {
    id: 'cottage-pie', name: 'Cottage pie with peas', cuisine: 'British',
    protein: 'mince', time: 75, kid: true, veg: 2, tags: ['red-meat', 'batch'],
    tip: 'Let them help mash and fork the top.',
    ingredients: ['500g beef mince', '1 onion', '2 carrots', '1kg potatoes', '150g frozen peas', '100ml milk',
      '50g butter'],
    staples: ['Worcestershire sauce', 'beef stock cube', 'tomato purée', 'plain flour'],
    method: [
      'Brown the mince with onion and carrot, stir in 1 tbsp flour, 1 tbsp purée, a dash of Worcestershire and 300ml stock. Simmer 20 min.',
      'Boil the potatoes and mash with butter and milk.',
      'Top the mince with mash and bake at 200°C for 25 min until golden. Serve with peas.'],
  },
  {
    id: 'lamb-keema', name: 'Lamb keema with peas', cuisine: 'Indian',
    protein: 'mince', time: 35, kid: true, veg: 1.5, tags: ['red-meat'],
    tip: 'Mild and mince-based — try scooping it up with chapati.',
    ingredients: ['500g lamb mince', '1 onion', '3 cloves garlic', '1 thumb ginger', '1 tin chopped tomatoes',
      '200g frozen peas', '300g basmati rice', '4 chapatis'],
    staples: ['garam masala', 'ground cumin', 'turmeric', 'vegetable oil'],
    method: [
      'Soften onion, add garlic, ginger and 1 tsp each spice.',
      'Brown the mince, add tomatoes and simmer 20 min.',
      'Stir through the peas for 3 min. Serve with rice and chapatis.'],
  },
  {
    id: 'lamb-koftas', name: 'Greek lamb koftas with pitta & tzatziki', cuisine: 'Greek',
    protein: 'mince', time: 30, kid: true, veg: 1.5, tags: ['red-meat'],
    tip: 'Shape some mini koftas — little hands like little food.',
    ingredients: ['500g lamb mince', '1 red onion', '6 pitta breads', '250g Greek yoghurt', '1 cucumber',
      '250g cherry tomatoes', '2 cloves garlic', '1 lemon'],
    staples: ['ground cumin', 'dried mint', 'olive oil'],
    method: [
      'Mix the mince with half the grated onion, 1 tsp cumin and 1 tsp mint; shape into 12 koftas.',
      'Griddle or grill 10–12 min, turning.',
      'Make tzatziki with yoghurt, grated cucumber, garlic and lemon.',
      'Serve in warm pittas with tomatoes and the rest of the onion.'],
  },
  {
    id: 'pad-kra-pao', name: 'Thai basil pork (pad kra pao) with fried egg', cuisine: 'Thai',
    protein: 'mince', time: 20, kid: false, veg: 1, tags: ['spicy', 'quick'],
    tip: 'Cook the chillies in last, after scooping out a mild portion.',
    ingredients: ['500g pork mince', '4 cloves garlic', '2 red chillies', '1 bunch basil', '2 tbsp oyster sauce',
      '300g jasmine rice', '4 eggs', '150g green beans'],
    staples: ['soy sauce', 'fish sauce', 'sugar', 'vegetable oil'],
    method: [
      'Fry the garlic, then the mince over high heat until browned.',
      'Add chopped beans, oyster sauce, 1 tbsp each soy and fish sauce, a pinch of sugar. Stir in chillies.',
      'Wilt in the basil. Fry the eggs crispy and serve on rice.'],
  },
  {
    id: 'lasagne', name: 'Beef lasagne & salad', cuisine: 'Italian',
    protein: 'mince', time: 90, kid: true, veg: 2, tags: ['red-meat', 'batch'],
    tip: 'Weekend job — make two and freeze one.',
    ingredients: ['500g beef mince', '1 onion', '2 carrots', '2 tins chopped tomatoes', '250g lasagne sheets',
      '500ml milk', '50g butter', '150g grated mozzarella', '1 bag mixed salad'],
    staples: ['plain flour', 'tomato purée', 'dried oregano', 'olive oil', 'nutmeg'],
    method: [
      'Make a bolognese with the mince, onion, carrot, tomatoes and purée; simmer 30 min.',
      'White sauce: melt the butter, stir in 50g flour, whisk in the milk until thick. Season with nutmeg.',
      'Layer sauce, sheets and white sauce; top with mozzarella.',
      'Bake at 190°C for 40 min. Rest 10 min and serve with salad.'],
  },

  // ---------------------------------------------- Pork, lamb, fish & prawns
  {
    id: 'pork-chops-apple', name: 'Pork chops, apple & mash', cuisine: 'British',
    protein: 'pork', time: 35, kid: true, veg: 2, tags: [],
    tip: 'Apple slices on the side make it feel like a treat.',
    ingredients: ['4 pork loin chops', '1kg potatoes', '2 apples', '1 savoy cabbage', '100ml milk', '50g butter'],
    staples: ['dried sage', 'olive oil', 'chicken stock cube'],
    method: [
      'Boil and mash the potatoes with butter and milk.',
      'Fry the chops 4–5 min a side with sage; rest.',
      'Fry apple wedges in the pan juices with a splash of stock until soft.',
      'Shred and steam the cabbage. Serve.'],
  },
  {
    id: 'sausage-casserole', name: 'Sausage & bean casserole', cuisine: 'British',
    protein: 'pork', time: 45, kid: true, veg: 2, tags: ['batch'],
    tip: 'Basically posh beans and sausages — always eaten.',
    ingredients: ['8 pork sausages', '1 tin chopped tomatoes', '1 tin cannellini beans', '1 onion', '1 pepper',
      '2 carrots', '1 crusty loaf'],
    staples: ['smoked paprika', 'olive oil', 'chicken stock cube'],
    method: [
      'Brown the sausages; remove.',
      'Soften the onion, pepper and carrot, add 1 tsp paprika, tomatoes, beans and 200ml stock.',
      'Return the sausages and simmer 25 min. Serve with crusty bread.'],
  },
  {
    id: 'ham-pasta-bake', name: 'Cheesy ham & pea pasta bake', cuisine: 'British',
    protein: 'pork', time: 30, kid: true, veg: 1, tags: ['quick'],
    tip: 'Great for a one-off night — and it reheats well.',
    ingredients: ['300g penne', '150g cooked ham', '200g frozen peas', '500ml milk', '150g grated cheddar',
      '50g butter', '1 broccoli'],
    staples: ['plain flour', 'mustard'],
    method: [
      'Cook the pasta with the broccoli florets for the last 4 min, adding the peas for the last 2.',
      'Cheese sauce: melt butter, stir in 40g flour, whisk in milk until thick, add 100g cheese and ½ tsp mustard.',
      'Mix everything with the chopped ham, top with the rest of the cheese and grill until bubbling.'],
  },
  {
    id: 'lamb-tagine', name: 'Moroccan lamb tagine with couscous', cuisine: 'Moroccan',
    protein: 'lamb', time: 120, kid: true, veg: 2, tags: ['red-meat', 'batch'],
    tip: 'The apricots make it sweet — slow cooker friendly too.',
    ingredients: ['600g diced lamb', '1 tin chopped tomatoes', '1 tin chickpeas', '100g dried apricots', '1 onion',
      '250g couscous', '2 carrots', '1 bunch coriander'],
    staples: ['ras el hanout', 'ground cinnamon', 'honey', 'chicken stock cube', 'olive oil'],
    method: [
      'Brown the lamb in batches; soften the onion and carrots.',
      'Add 2 tbsp ras el hanout, ½ tsp cinnamon, tomatoes, 300ml stock and the apricots.',
      'Cover and simmer gently for 1½ hours (or 6 h on low in a slow cooker). Add chickpeas for the last 20 min.',
      'Serve with fluffy couscous and coriander.'],
  },
  {
    id: 'fish-tacos', name: 'Crispy fish tacos with slaw', cuisine: 'Mexican',
    protein: 'fish', time: 30, kid: true, veg: 1.5, tags: [],
    tip: 'Fish fingers in a wrap by another name.',
    ingredients: ['500g cod fillets', '80g panko breadcrumbs', '1 egg', '8 small tortilla wraps',
      '1 small red cabbage', '2 limes', '1 avocado', '150ml soured cream'],
    staples: ['plain flour', 'smoked paprika', 'vegetable oil'],
    method: [
      'Cut the cod into strips, dust with flour and paprika, dip in egg and panko.',
      'Bake at 220°C for 15 min or shallow fry until golden.',
      'Shred the cabbage with lime juice and salt for a quick slaw.',
      'Fill warm tortillas with fish, slaw, avocado and soured cream.'],
  },
  {
    id: 'fish-fingers', name: 'Homemade fish fingers, chips & peas', cuisine: 'British',
    protein: 'fish', time: 35, kid: true, veg: 1, tags: [],
    tip: 'Kids can do the breadcrumbing — messy but proud.',
    ingredients: ['500g cod fillets', '100g panko breadcrumbs', '2 eggs', '800g potatoes', '200g frozen peas',
      '1 lemon'],
    staples: ['plain flour', 'olive oil', 'mayonnaise'],
    method: [
      'Cut the potatoes into chips, toss with oil and roast at 220°C for 35 min.',
      'Cut the cod into fingers, coat in flour, egg and panko; bake 15 min.',
      'Serve with peas, lemon and mayo mixed with a squeeze of lemon.'],
  },
  {
    id: 'jacket-potatoes', name: 'Jacket potatoes with tuna mayo & beans', cuisine: 'British',
    protein: 'fish', time: 70, kid: true, veg: 1.5, tags: [],
    tip: 'Hands-off: oven does the work. Beans for the boys, tuna for you.',
    ingredients: ['4 baking potatoes', '2 tins tuna', '1 tin baked beans', '150g sweetcorn', '100g grated cheddar',
      '1 bag mixed salad'],
    staples: ['mayonnaise', 'olive oil'],
    method: [
      'Rub the potatoes with oil and salt and bake at 200°C for 1 hour (or microwave 10 min then oven 20 min).',
      'Mix the tuna with mayo and sweetcorn; heat the beans.',
      'Split the potatoes and pile in fillings and cheese. Serve with salad.'],
  },
  {
    id: 'prawn-pad-thai', name: 'Prawn pad thai', cuisine: 'Thai',
    protein: 'prawns', time: 25, kid: true, veg: 1.5, tags: ['nuts', 'quick'],
    tip: 'Leave the chilli and peanuts on the side.',
    ingredients: ['250g raw king prawns', '200g flat rice noodles', '200g beansprouts', '2 eggs',
      '1 bunch spring onions', '2 limes', '50g roasted peanuts', '3 tbsp pad thai sauce'],
    staples: ['vegetable oil', 'soy sauce'],
    method: [
      'Soak the noodles according to the pack.',
      'Stir-fry the prawns 2 min, push aside and scramble the eggs.',
      'Add noodles, sauce and beansprouts and toss for 2 min.',
      'Serve with spring onions, chopped peanuts and lime.'],
  },
  {
    id: 'prawn-linguine', name: 'Garlic prawn & tomato linguine', cuisine: 'Italian',
    protein: 'prawns', time: 20, kid: true, veg: 1.5, tags: ['quick'],
    tip: 'Keep the chilli for the adults\' plates.',
    ingredients: ['250g raw king prawns', '300g linguine', '250g cherry tomatoes', '1 red chilli', '1 lemon',
      '3 cloves garlic', '70g rocket'],
    staples: ['olive oil'],
    method: [
      'Cook the linguine.',
      'Fry the garlic in oil, add halved tomatoes until they burst, then the prawns for 3 min.',
      'Toss with the pasta, lemon and a splash of pasta water. Top with rocket and chilli.'],
  },

  // ------------------------------------------------------------- Vegetarian
  {
    id: 'halloumi-traybake', name: 'Halloumi & roasted veg couscous', cuisine: 'Greek',
    protein: 'veggie', time: 35, kid: true, veg: 3, tags: [],
    tip: 'Squeaky cheese is a novelty — they\'ll eat it for that alone.',
    ingredients: ['2 packs halloumi', '2 peppers', '1 courgette', '1 red onion', '250g cherry tomatoes',
      '250g couscous', '1 lemon'],
    staples: ['olive oil', 'dried oregano', 'vegetable stock cube'],
    method: [
      'Roast the chopped veg in oil and oregano at 200°C for 25 min.',
      'Add sliced halloumi for the last 10 min.',
      'Pour 300ml hot stock over the couscous, cover 5 min, fluff with lemon juice. Serve together.'],
  },
  {
    id: 'chana-masala', name: 'Chickpea & spinach curry', cuisine: 'Indian',
    protein: 'veggie', time: 30, kid: true, veg: 2.5, tags: ['batch'],
    tip: 'Coconut milk keeps it gentle for little ones.',
    ingredients: ['2 tins chickpeas', '1 tin chopped tomatoes', '1 tin coconut milk', '1 onion', '200g baby spinach',
      '3 cloves garlic', '1 thumb ginger', '300g basmati rice'],
    staples: ['garam masala', 'ground cumin', 'turmeric', 'vegetable oil'],
    method: [
      'Soften the onion, add garlic, ginger and 1 tsp of each spice.',
      'Add tomatoes, coconut milk and chickpeas; simmer 15 min.',
      'Stir in the spinach and serve with rice.'],
  },
  {
    id: 'mushroom-risotto', name: 'Mushroom & pea risotto', cuisine: 'Italian',
    protein: 'veggie', time: 40, kid: true, veg: 1.5, tags: [],
    tip: 'Chop the mushrooms small if they\'re mushroom-sceptics.',
    ingredients: ['300g arborio rice', '300g chestnut mushrooms', '1 onion', '150g frozen peas', '50g parmesan',
      '2 cloves garlic'],
    staples: ['vegetable stock cube', 'butter', 'olive oil'],
    method: [
      'Fry the mushrooms until golden; set aside.',
      'Soften onion and garlic, add the rice and stir 1 min.',
      'Add 1 litre hot stock a ladle at a time, stirring, for 18–20 min.',
      'Stir in peas, mushrooms, butter and parmesan.'],
  },
  {
    id: 'spanakopita', name: 'Spanakopita (spinach & feta pie)', cuisine: 'Greek',
    protein: 'veggie', time: 50, kid: false, veg: 2, tags: [],
    tip: 'Call it "crunchy cheese pie".',
    ingredients: ['1 pack filo pastry', '200g feta', '400g frozen spinach', '2 eggs', '1 bunch spring onions',
      '1 bag mixed salad'],
    staples: ['olive oil', 'dried dill', 'nutmeg'],
    method: [
      'Defrost and squeeze the spinach dry. Mix with feta, eggs, spring onions, dill and nutmeg.',
      'Layer half the filo in an oiled dish, brushing each sheet with oil. Add the filling, top with the rest.',
      'Bake at 190°C for 35 min until golden. Serve with salad.'],
  },
  {
    id: 'egg-fried-rice', name: 'Vegetable egg fried rice', cuisine: 'Chinese',
    protein: 'veggie', time: 20, kid: true, veg: 2, tags: ['quick'],
    tip: 'Use leftover rice — it fries better. Quick one-off night saviour.',
    ingredients: ['300g long grain rice', '4 eggs', '200g frozen peas', '2 carrots', '1 bunch spring onions',
      '150g sweetcorn'],
    staples: ['soy sauce', 'sesame oil', 'vegetable oil'],
    method: [
      'Cook the rice and cool completely (or use leftovers).',
      'Stir-fry diced carrot, peas and sweetcorn for 3 min.',
      'Push aside, scramble the eggs, then add the rice and 2–3 tbsp soy. Toss until hot.',
      'Finish with sesame oil and spring onions.'],
  },
  {
    id: 'bean-burritos', name: 'Black bean & sweet potato burritos', cuisine: 'Mexican',
    protein: 'veggie', time: 35, kid: true, veg: 2.5, tags: [],
    tip: 'Roll small ones for small hands.',
    ingredients: ['2 sweet potatoes', '1 tin black beans', '8 tortilla wraps', '150g sweetcorn',
      '100g grated cheddar', '1 avocado', '1 lime'],
    staples: ['ground cumin', 'smoked paprika', 'olive oil'],
    method: [
      'Roast cubed sweet potato with oil and spices at 200°C for 25 min.',
      'Warm the beans and sweetcorn and roughly mash with the sweet potato.',
      'Fill the wraps with the mix, cheese and avocado; toast in a dry pan.'],
  },

  // -------------------------------------------------------------- Leftovers
  // Only suggested the day after their source meal. `extraScale` adds that
  // much extra to the source meal's shopping so there's enough left over.
  {
    id: 'roast-chicken-fried-rice', name: 'Leftover roast chicken fried rice', cuisine: 'Chinese',
    protein: 'chicken', time: 20, kid: true, veg: 1.5, tags: ['quick', 'leftovers'],
    leftoverOf: 'roast-chicken', extraScale: 0,
    tip: 'Uses up yesterday\'s roast — shred the chicken small for the boys.',
    ingredients: ['300g long grain rice', '3 eggs', '150g frozen peas', '1 bunch spring onions', '150g sweetcorn'],
    staples: ['soy sauce', 'sesame oil', 'vegetable oil'],
    method: [
      'Cook the rice (or use leftover rice) and let it steam dry.',
      'Stir-fry the peas and sweetcorn 3 min, push aside and scramble the eggs.',
      'Add the rice, shredded leftover chicken and 2–3 tbsp soy; toss until piping hot.',
      'Finish with sesame oil and spring onions.'],
  },
  {
    id: 'chilli-jackets', name: 'Leftover chilli jacket potatoes', cuisine: 'Mexican',
    protein: 'mince', time: 25, kid: true, veg: 1.5, tags: ['red-meat', 'leftovers'],
    leftoverOf: 'chilli-con-carne', extraScale: 0.6,
    tip: 'Mild chilli on a buttery potato — easy win.',
    ingredients: ['4 baking potatoes', '100g grated cheddar', '1 bag mixed salad'],
    staples: ['butter'],
    method: [
      'Prick the potatoes and microwave 8–10 min, then crisp in a hot oven for 15 min.',
      'Reheat the leftover chilli until piping hot.',
      'Split the potatoes, spoon over the chilli and top with cheese. Salad on the side.'],
  },
  {
    id: 'bolognese-pasta-bake', name: 'Leftover bolognese pasta bake', cuisine: 'Italian',
    protein: 'mince', time: 30, kid: true, veg: 1.5, tags: ['red-meat', 'leftovers'],
    leftoverOf: 'spag-bol', extraScale: 0.6,
    tip: 'Different shape, same sauce — counts as a new meal to a 3-year-old.',
    ingredients: ['300g penne', '150g grated mozzarella', '1 bag mixed salad'],
    staples: [],
    method: [
      'Cook the penne and mix with the leftover bolognese.',
      'Tip into a dish, cover with mozzarella and bake at 200°C for 15–20 min.'],
  },

  // ------------------------------------------------------------ Cheat meals
  {
    id: 'takeaway', name: 'Takeaway night', cuisine: 'Takeaway',
    protein: 'mixed', time: 0, kid: true, veg: 0, tags: [], cheat: true,
    tip: 'Let the boys choose one side dish each.',
    ingredients: [], staples: [],
    method: ['Order in, sit back. Nothing to buy for this one.'],
  },
  {
    id: 'homemade-pizza', name: 'Make-your-own pizza night', cuisine: 'Italian',
    protein: 'mixed', time: 30, kid: true, veg: 1, tags: [], cheat: true,
    tip: 'Everyone makes their own — the boys will love it.',
    ingredients: ['4 pizza bases', '1 jar pizza sauce', '250g grated mozzarella', '100g pepperoni', '1 pepper',
      '150g sweetcorn', '1 bag mixed salad'],
    staples: ['dried oregano'],
    method: [
      'Heat oven as hot as it goes.',
      'Lay out the toppings and let everyone build their own.',
      'Bake 10–12 min until bubbling. Salad on the side to keep it honest.'],
  },
  {
    id: 'smash-burgers', name: 'Smash burgers & fries', cuisine: 'American',
    protein: 'mince', time: 30, kid: true, veg: 0.5, tags: ['red-meat'], cheat: true,
    tip: 'Make little sliders for the boys.',
    ingredients: ['500g beef mince', '6 brioche buns', '6 cheese slices', '1 little gem lettuce', '2 tomatoes',
      '900g frozen fries'],
    staples: ['ketchup', 'mayonnaise', 'mustard'],
    method: [
      'Oven-cook the fries.',
      'Roll the mince into 6 balls. In a very hot pan, smash each flat with a spatula; cook 2 min, flip, add cheese, 1 min more.',
      'Toast the buns and stack with lettuce, tomato and sauces.'],
  },
  {
    id: 'sweet-sour-chicken', name: 'Fakeaway sweet & sour chicken', cuisine: 'Chinese',
    protein: 'chicken', time: 30, kid: true, veg: 1.5, tags: [], cheat: true,
    tip: 'Pineapple! Better than the takeaway and half the price.',
    ingredients: ['500g chicken breast', '1 pepper', '1 tin pineapple chunks', '1 onion', '300g long grain rice',
      '1 egg'],
    staples: ['cornflour', 'ketchup', 'rice vinegar', 'soy sauce', 'brown sugar', 'vegetable oil'],
    method: [
      'Dip chicken pieces in beaten egg then cornflour; shallow fry until crisp.',
      'Stir-fry pepper and onion, add pineapple, 4 tbsp ketchup, 2 tbsp each vinegar, sugar and soy and 100ml pineapple juice.',
      'Thicken with a little cornflour slurry, toss in the chicken. Serve with rice.'],
  },
  {
    id: 'chippy-tea', name: 'Oven fish & chips with mushy peas', cuisine: 'British',
    protein: 'fish', time: 30, kid: true, veg: 1, tags: [], cheat: true,
    tip: 'Friday night classic — newspaper optional.',
    ingredients: ['4 frozen battered fish fillets', '900g frozen oven chips', '1 tin mushy peas', '1 lemon'],
    staples: ['tartare sauce', 'malt vinegar'],
    method: ['Cook the fish and chips according to the packs; heat the peas. Serve with lemon and vinegar.'],
  },
  {
    id: 'loaded-nachos', name: 'Loaded nachos sharing tray', cuisine: 'Mexican',
    protein: 'veggie', time: 20, kid: true, veg: 1, tags: ['quick'], cheat: true,
    tip: 'Movie night food — eat it on the sofa.',
    ingredients: ['1 bag tortilla chips', '1 tin black beans', '150g grated cheddar', '1 jar salsa',
      '150ml soured cream', '1 avocado'],
    staples: [],
    method: [
      'Spread the chips on a big tray, scatter with beans and cheese.',
      'Bake at 200°C for 8 min until melted.',
      'Spoon over salsa, soured cream and chopped avocado.'],
  },
];

export const PROTEIN_LABELS = {
  chicken: 'Chicken', steak: 'Steak', salmon: 'Salmon', mince: 'Mince', beef: 'Beef', pork: 'Pork',
  lamb: 'Lamb', fish: 'Fish', prawns: 'Prawns', veggie: 'Veggie', mixed: 'Mixed',
};

export const PROTEIN_EMOJI = {
  chicken: '🍗', steak: '🥩', salmon: '🐟', mince: '🍝', beef: '🥩', pork: '🐖',
  lamb: '🐑', fish: '🐠', prawns: '🦐', veggie: '🥦', mixed: '🍕',
};
