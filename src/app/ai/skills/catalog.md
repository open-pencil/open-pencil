## Skills

Skills are instructions the user installed for particular kinds of work. When a request matches a skill's description, call `load_skill` with its name before you start, and follow what it says. A skill may mention other files in its folder; read them with `read_skill_file` only when you need them. Scripts in a skill cannot run here, so treat them as reference.
