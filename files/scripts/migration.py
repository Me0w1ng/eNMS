from pathlib import Path
from ruamel import yaml


FILENAME = "examples"
PATH = Path.cwd().parent.parent.parent / "eNMS-prod" / "files" / "migrations"


def migrate_from_4_to_4_2():
    with open(PATH / FILENAME / "service.yaml", "r") as migration_file:
        services = yaml.load(migration_file)
    for service in services:
        service["priority"] += 9
        if service["type"] == "rest_call_service":
            service["custom_username"] = service.pop("username", "")
            service["custom_password"] = service.pop("password", "")
        if service["type"] == "git_service":
            actions = []
            if "git_repository" in service:
                service["local_repository"] = service.pop("git_repository")
            for action in ("add_commit", "pull", "push"):
                if service.pop(action, False):
                    actions.append(action)
            service["actions"] = actions
    with open(PATH / FILENAME / "service.yaml", "w") as migration_file:
        yaml.dump(services, migration_file)


def migrate_from_4_2_to_4_3():
    with open(PATH / FILENAME / "service.yaml", "r") as migration_file:
        services = yaml.load(migration_file)
    for service in services:
        if service["type"] == "netmiko_validation_service":
            service["type"] = "netmiko_commands_service"
            service["commands"] = service.pop("command", "")
        if service.pop("use_device_driver", False):
            service["driver"] = "device_driver"
    with open(PATH / FILENAME / "service.yaml", "w") as migration_file:
        yaml.dump(services, migration_file)


migrate_from_4_2_to_4_3()
