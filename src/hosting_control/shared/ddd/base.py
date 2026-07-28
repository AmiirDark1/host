"""Base classes for Domain-Driven Design implementation.

This module provides the foundational building blocks for DDD:
- Entity: Objects with identity
- ValueObject: Immutable objects defined by their attributes
- Aggregate: Cluster of entities with consistency boundaries
- DomainEvent: Something important that happened in the domain
- Repository: Collection-like interface for aggregates
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, ClassVar, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_serializer


class DomainEvent(BaseModel):
    """Base class for all domain events.

    Domain events capture something important that happened in the domain.
    They are immutable and timestamped.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str = Field(default="")
    aggregate_id: str = Field(default="")
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = Field(default=1)

    def __init__(self, **data: Any) -> None:
        if "event_type" not in data or not data["event_type"]:
            data["event_type"] = self.__class__.__name__
        super().__init__(**data)


class ValueObject(BaseModel):
    """Base class for value objects.

    Value objects are immutable, defined by their attributes, and have no identity.
    Two value objects are equal if all their attributes are equal.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    def __hash__(self) -> int:
        return hash(tuple(self.model_dump().items()))


class Entity(BaseModel):
    """Base class for entities.

    Entities have a unique identity that persists throughout their lifecycle.
    Equality is based on identity, not attributes.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    _events: list[DomainEvent] = []

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Entity):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    def add_event(self, event: DomainEvent) -> None:
        """Record a domain event to be published later."""
        event.aggregate_id = self.id
        self._events.append(event)

    def pop_events(self) -> list[DomainEvent]:
        """Retrieve and clear pending domain events."""
        events = list(self._events)
        self._events.clear()
        return events

    def mark_updated(self) -> None:
        """Mark the entity as updated."""
        self.updated_at = datetime.now(timezone.utc)


class Aggregate(Entity):
    """Base class for aggregates.

    Aggregates are clusters of entities with consistency boundaries.
    They ensure transactional consistency within the aggregate.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    _version: int = Field(default=1, exclude=True)

    @property
    def version(self) -> int:
        return self._version

    def increment_version(self) -> None:
        """Increment the aggregate version for optimistic concurrency."""
        self._version += 1


T = TypeVar("T", bound=Aggregate)


class Repository(ABC, Generic[T]):
    """Base class for repositories.

    Repositories provide a collection-like interface for aggregates,
    hiding the underlying storage implementation.
    """

    @abstractmethod
    async def save(self, aggregate: T) -> T:
        """Persist an aggregate."""
        ...

    @abstractmethod
    async def get_by_id(self, id: str) -> Optional[T]:
        """Retrieve an aggregate by its identity."""
        ...

    @abstractmethod
    async def delete(self, aggregate: T) -> None:
        """Remove an aggregate from the repository."""
        ...

    @abstractmethod
    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[T], int]:
        """List aggregates with pagination and filtering.

        Returns a tuple of (items, total_count).
        """
        ...


class UnitOfWork(ABC):
    """Base class for Unit of Work pattern.

    The Unit of Work maintains a list of objects affected by a business
    transaction and coordinates the writing out of changes.
    """

    @abstractmethod
    async def __aenter__(self) -> UnitOfWork:
        ...

    @abstractmethod
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        ...

    @abstractmethod
    async def commit(self) -> None:
        """Commit the current transaction."""
        ...

    @abstractmethod
    async def rollback(self) -> None:
        """Rollback the current transaction."""
        ...


class Specification(ABC):
    """Base class for specifications.

    Specifications define business rules that can be combined
    to filter or validate aggregates.
    """

    @abstractmethod
    def is_satisfied_by(self, candidate: Aggregate) -> bool:
        """Check if the specification is satisfied by the candidate."""
        ...


class AndSpecification(Specification):
    """Composite specification that requires all specifications to be satisfied."""

    def __init__(self, *specs: Specification) -> None:
        self.specs = specs

    def is_satisfied_by(self, candidate: Aggregate) -> bool:
        return all(spec.is_satisfied_by(candidate) for spec in self.specs)


class OrSpecification(Specification):
    """Composite specification that requires at least one specification to be satisfied."""

    def __init__(self, *specs: Specification) -> None:
        self.specs = specs

    def is_satisfied_by(self, candidate: Aggregate) -> bool:
        return any(spec.is_satisfied_by(candidate) for spec in self.specs)


class NotSpecification(Specification):
    """Composite specification that negates a specification."""

    def __init__(self, spec: Specification) -> None:
        self.spec = spec

    def is_satisfied_by(self, candidate: Aggregate) -> bool:
        return not self.spec.is_satisfied_by(candidate)