from flask_login import current_user as user
from sqlalchemy.ext.mutable import MutableDict, MutableList
from typing import Any, List, Optional

from eNMS import app
from eNMS.database import Base, Session
from eNMS.database.functions import fetch, objectify
from eNMS.models import model_properties, property_types, relationships
from eNMS.properties import dont_serialize, private_properties
from eNMS.properties.database import dont_migrate


class AbstractBase(Base):

    __abstract__ = True

    def __init__(self, **kwargs: Any) -> None:
        self.update(**kwargs)

    def __lt__(self, other: Base) -> bool:
        return True

    def __repr__(self) -> str:
        return self.name

    def __getattribute__(self, property: str) -> Any:
        if property in private_properties and app.use_vault:
            path = f"secret/data/{self.__tablename__}/{self.name}/{property}"
            data = app.vault_client.read(path)
            return data["data"]["data"][property] if data else ""
        else:
            return super().__getattribute__(property)

    def __setattr__(self, property: str, value: Any) -> None:
        if property in private_properties:
            if not value:
                return
            if app.use_vault:
                app.vault_client.write(
                    f"secret/data/{self.__tablename__}/{self.name}/{property}",
                    data={property: value},
                )
            else:
                super().__setattr__(property, value)
        else:
            super().__setattr__(property, value)

    @property
    def row_properties(self) -> dict:
        return {p: getattr(self, p) for p in ("id", "name", "type")}

    def update(self, **kwargs: Any) -> None:
        relation = relationships[self.__tablename__]
        for property, value in kwargs.items():
            if not hasattr(self, property):
                continue
            property_type = property_types.get(property, None)
            if property in relation:
                if relation[property]["list"]:
                    value = objectify(relation[property]["model"], value)
                else:
                    value = fetch(relation[property]["model"], id=value)
            if property_type == "bool":
                value = value not in (False, "false")
            setattr(self, property, value)

    def get_properties(
        self, export: bool = False, include: Optional[list] = None
    ) -> dict:
        if include is None:
            include = []
        result = {}
        for property in model_properties[self.type]:
            if property in private_properties:
                continue
            if property not in include and property in dont_serialize:
                continue
            value = getattr(self, property)
            if export:
                if isinstance(value, MutableList):
                    value = list(value)
                if isinstance(value, MutableDict):
                    value = dict(value)
                if value is None:
                    continue
            result[property] = value
        return result

    def to_dict(self, export: bool = False, include: Optional[list] = None) -> dict:
        if include is None:
            include = []
        properties = self.get_properties(export)
        no_migrate = dont_migrate.get(self.type, dont_migrate["Service"])
        for property, relation in relationships[self.type].items():
            value = getattr(self, property)
            if property not in include:
                continue
            if export and property in no_migrate:
                continue
            if relation["list"]:
                properties[property] = [
                    obj.name if export else obj.get_properties(include=include)
                    for obj in value
                ]
            else:
                if not value:
                    continue
                properties[property] = (
                    value.name if export else value.get_properties(include=include)
                )
        if export:
            for property in no_migrate:
                properties.pop(property, None)
        return properties

    @classmethod
    def visible(cls) -> List:
        if cls.__tablename__ == "Pool" and user.pools:
            return user.pools
        elif cls.__tablename__ in ("Device", "Link") and user.pools:
            objects: set = set()
            for pool in user.pools:
                objects |= set(getattr(pool, f"{cls.class_type}s"))
            return list(objects)
        else:
            return Session.query(cls).all()

    @property
    def serialized(self) -> dict:
        return self.to_dict()
