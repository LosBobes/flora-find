"""Seed FloraFind with sample plants around Belgrade & Serbia.

Run from the ``backend`` directory:

    python seed.py            # seed only if the database has no plants yet
    python seed.py --force    # add the sample plants even if others already exist

It creates two accounts and a spread of real Belgrade parks/neighbourhoods
(plus a few entries in Novi Sad, Niš and Subotica):

    admin@florafind.rs / admin1234   : an ADMIN who can export map areas
    seed@florafind.rs  / seed1234    : the contributor who "registered" the plants

The coordinates are hand-picked to fall inside well-known green spaces
(Kalemegdan, Ada Ciganlija, Tašmajdan, Košutnjak, Zemun, Topčider…), so the
seeded map looks realistic when you open it centred on Belgrade.
"""

import sys

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.models import Tree, User
from app.plant_type_seed import backfill_plant_types

ADMIN = {"email": "admin@florafind.rs", "username": "admin", "password": "admin1234"}
CONTRIBUTOR = {"email": "seed@florafind.rs", "username": "belgrade_forager", "password": "seed1234"}


# category, name, fruit_type, lat, lng, species, description, season_start, season_end, hazard
PLANTS = [
    # --- Belgrade: Stari Grad / Kalemegdan / Dorćol ---
    ("fruit_tree", "Old mulberry by Kalemegdan wall", "Mulberry", 44.8226, 20.4512,
     "Morus alba", "Big white mulberry (dud) dropping sweet fruit onto the path in June.", 6, 7, False),
    ("tree", "Horse chestnut avenue, Kalemegdan", "Horse chestnut", 44.8237, 20.4526,
     "Aesculus hippocastanum", "Row of old divlji kesten lining the fortress promenade; candles of white flowers in May.", 5, 5, False),
    ("vine", "Grapevine over a Dorćol courtyard fence", "Grape", 44.8231, 20.4636,
     "Vitis vinifera", "Table grapes spilling over a low wall on a quiet Dorćol street.", 9, 10, False),
    ("vine", "Wisteria in Skadarlija", "Wisteria", 44.8181, 20.4646,
     "Wisteria sinensis", "Purple wisteria draping a tavern terrace in the bohemian quarter.", 4, 5, False),
    ("flowerbed", "Rose beds in Pionirski park", "Roses", 44.8095, 20.4651,
     "Rosa", "Formal rose beds opposite the old presidency building.", 5, 9, False),
    ("shrub", "Lilac hedge, Pionirski park", "Lilac", 44.8090, 20.4657,
     "Syringa vulgaris", "Fragrant jorgovan hedge that scents the whole park in late April.", 4, 5, False),

    # --- Belgrade: Vračar ---
    ("flowerbed", "Rose garden by Sveti Sava", "Roses", 44.7985, 20.4690,
     "Rosa", "Rose plantings around the great temple on Vračar plateau.", 5, 9, False),
    ("tree", "Magnolia in Karađorđev park", "Magnolia", 44.7975, 20.4720,
     "Magnolia soulangeana", "Pink saucer magnolia that blooms before its leaves in early spring.", 3, 4, False),
    ("fruit_tree", "Sour cherry behind Tašmajdan", "Sour cherry", 44.8065, 20.4705,
     "Prunus cerasus", "Classic višnja — tart cherries perfect for juice and pie in early summer.", 6, 7, False),
    ("tree", "Linden by the Tašmajdan pool", "Linden", 44.8072, 20.4718,
     "Tilia cordata", "Lipa in full bloom in June; locals pick the flowers for tea.", 6, 6, False),

    # --- Belgrade: Novi Beograd / Zemun / Ušće ---
    ("fruit_tree", "Apple tree, Novi Beograd Blok 21", "Apple", 44.8155, 20.4075,
     "Malus domestica", "Self-seeded apple between the tower blocks; small but crisp fruit.", 9, 10, False),
    ("tree", "Linden alley in Blok 45", "Linden", 44.8020, 20.3880,
     "Tilia platyphyllos", "Long shaded linden walk along the New Belgrade quay.", 6, 6, False),
    ("tree", "Silver birches at Ušće park", "Birch", 44.8215, 20.4415,
     "Betula pendula", "Cluster of white-barked birches near the confluence of the Sava and Danube.", None, None, False),
    ("shrub", "Elderberry at Ušće", "Elderberry", 44.8225, 20.4400,
     "Sambucus nigra", "Zova bushes along the riverbank — cream flower heads in spring, berries in late summer.", 8, 9, False),
    ("fruit_tree", "Fig on Gardoš hill, Zemun", "Fig", 44.8452, 20.4102,
     "Ficus carica", "Sun-loving fig tucked beside the Millennium Tower steps.", 8, 9, False),
    ("fruit_tree", "Mulberry along the Zemun quay", "Mulberry", 44.8440, 20.4130,
     "Morus nigra", "Dark mulberry shading the riverside promenade; stains the pavement purple.", 6, 7, False),
    ("fruit_tree", "Walnut in Bežanijska kosa", "Walnut", 44.8095, 20.3925,
     "Juglans regia", "Mature orah dropping nuts onto a quiet residential street each autumn.", 9, 10, False),

    # --- Belgrade: Ada Ciganlija / Čukarica / Senjak ---
    ("fruit_tree", "Walnut grove, Ada Ciganlija", "Walnut", 44.7871, 20.4155,
     "Juglans regia", "Several walnut trees along the lake path — bring a bag in September.", 9, 10, False),
    ("fruit_tree", "Wild plum near Ada beach", "Plum", 44.7885, 20.4172,
     "Prunus cerasifera", "Cherry-plum (džanarika) heavy with small yellow-red fruit in high summer.", 7, 8, False),
    ("shrub", "Blackberry thickets, Ada Ciganlija", "Blackberry", 44.7860, 20.4200,
     "Rubus fruticosus", "Bramble patches along the far shore — good picking in late July.", 7, 8, False),
    ("fruit_tree", "Cherry in Senjak", "Cherry", 44.7862, 20.4460,
     "Prunus avium", "Sweet trešnja on a leafy embassy-district street.", 5, 6, False),
    ("fruit_tree", "Apricot in Banovo Brdo", "Apricot", 44.7745, 20.4215,
     "Prunus armeniaca", "Kajsija in a front garden, branches leaning over the pavement.", 6, 7, False),

    # --- Belgrade: Topčider / Košutnjak / Voždovac / Zvezdara ---
    ("tree", "Ancient plane tree, Topčider park", "Plane", 44.7712, 20.4515,
     "Platanus orientalis", "One of the oldest and largest plane trees in Belgrade, by Miloš's konak.", None, None, False),
    ("fruit_tree", "Quince by the Topčider stream", "Quince", 44.7725, 20.4530,
     "Cydonia oblonga", "Dunja with fragrant golden fruit that perfumes a whole room.", 10, 11, False),
    ("fruit_tree", "Sweet chestnut, Košutnjak forest", "Chestnut", 44.7662, 20.4375,
     "Castanea sativa", "Edible sweet chestnut (pitomi kesten) in the old royal forest.", 9, 10, False),
    ("fruit_tree", "Pear on a Voždovac street", "Pear", 44.7755, 20.4805,
     "Pyrus communis", "Old kruška shading a bus stop; ripe fruit falls in early autumn.", 9, 10, False),
    ("tree", "Oaks in Zvezdara forest", "Oak", 44.7935, 20.5105,
     "Quercus robur", "Stand of mature pedunculate oaks in the city's eastern woodland.", None, None, False),
    ("fruit_tree", "Peach in Karaburma", "Peach", 44.8155, 20.5005,
     "Prunus persica", "Garden peach heavy with fruit over a fence in mid-summer.", 7, 8, False),
    ("fruit_tree", "Hazelnut hedge, Miljakovac", "Hazelnut", 44.7555, 20.4625,
     "Corylus avellana", "Leska bushes at the forest edge — nuts ready to gather in late summer.", 8, 9, False),

    # --- Belgrade: hazards ---
    ("other", "Giant hogweed by the Sava bank", "Giant hogweed", 44.8135, 20.4525,
     "Heracleum mantegazzianum", "DO NOT TOUCH — sap causes severe skin burns in sunlight. Report to the city.", 6, 7, True),
    ("other", "Ragweed patch, New Belgrade wasteland", "Ragweed", 44.8100, 20.4000,
     "Ambrosia artemisiifolia", "Ambrozija — a major late-summer allergen. Marked so allergy sufferers can avoid it.", 8, 9, True),
    ("other", "Deadly nightshade, Košutnjak edge", "Deadly nightshade", 44.7650, 20.4400,
     "Atropa belladonna", "Highly poisonous berries — velebilje. Keep children and pets away.", 8, 9, True),

    # --- Serbia beyond Belgrade ---
    ("tree", "Linden in Dunavski park, Novi Sad", "Linden", 45.2540, 19.8530,
     "Tilia cordata", "Old lindens shading the city's central park.", 6, 6, False),
    ("vine", "Fruška Gora vineyard grapes", "Grape", 45.1600, 19.7100,
     "Vitis vinifera", "Terraced vineyards on the slopes of Fruška Gora above Novi Sad.", 9, 10, False),
    ("tree", "Plane trees in Čair park, Niš", "Plane", 43.3195, 21.8960,
     "Platanus", "Broad plane trees over the main promenade of Niš's biggest park.", None, None, False),
    ("fruit_tree", "Plum orchard edge near Niš", "Plum", 43.3100, 21.9200,
     "Prunus domestica", "Požegača plums — the classic Serbian variety for rakija and pekmez.", 8, 9, False),
    ("flowerbed", "Rose beds at Palić, Subotica", "Roses", 46.1000, 19.7660,
     "Rosa", "Ornamental rose beds by the lakeside resort of Palić.", 5, 9, False),
]


def get_or_create_user(db, email, username, password, is_admin=False):
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            username=username,
            password_hash=hash_password(password),
            is_admin=is_admin,
        )
        db.add(user)
        db.flush()
        print(f"  created user {email} (admin={is_admin})")
    elif is_admin and not user.is_admin:
        user.is_admin = True
        print(f"  promoted {email} to admin")
    return user


def main():
    force = "--force" in sys.argv

    run_migrations(engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Ensuring seed accounts…")
        get_or_create_user(db, **ADMIN, is_admin=True)
        contributor = get_or_create_user(db, **CONTRIBUTOR)
        db.commit()

        existing = db.query(Tree).count()
        if existing and not force:
            print(
                f"Database already has {existing} plant(s); skipping plant seed. "
                "Re-run with --force to add the sample plants anyway."
            )
            added_types = backfill_plant_types(db)
            if added_types:
                print(f"  registered {added_types} plant type(s) from existing plants")
            return

        for (category, name, fruit_type, lat, lng, species,
             description, season_start, season_end, hazard) in PLANTS:
            db.add(
                Tree(
                    name=name,
                    category=category,
                    fruit_type=fruit_type,
                    lat=lat,
                    lng=lng,
                    species=species,
                    description=description,
                    season_start=season_start,
                    season_end=season_end,
                    hazard=hazard,
                    owner_id=contributor.id,
                )
            )
        db.commit()
        added_types = backfill_plant_types(db)
        print(f"Seeded {len(PLANTS)} plants around Belgrade & Serbia.")
        print(f"Registered {added_types} plant type(s) in the vocabulary.")
        print(f"Admin login: {ADMIN['email']} / {ADMIN['password']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
