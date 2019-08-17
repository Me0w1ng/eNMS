from pathlib import Path
from ruamel import yaml


import_classes = [
    "User",
    "Device",
    "Link",
    "Pool",
    "Service",
    "Workflow",
    "WorkflowEdge",
    "Task",
]


def update_property(project, property, value=None, types=None):
    if not types:
        types = import_classes
    path = Path.cwd().parent.parent / "projects" / "migrations" / project
    print(path)
    for instance_type in types:

        with open(path / f"{instance_type}.yaml", "r") as migration_file:
            objects = yaml.load(migration_file)

        for obj in objects:
            if property not in obj:
                continue
            if not value:
                obj.pop(property)
            else:
                obj[property] = value

        with open(path / f"{instance_type}.yaml", "w") as migration_file:
            yaml.dump(objects, migration_file)

update_property("Backup0816_wdevs", "devices")
