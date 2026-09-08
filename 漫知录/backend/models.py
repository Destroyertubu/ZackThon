from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Literal
import math


class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid')


class WorldInput(Strict):
    seed: str=Field(min_length=2,max_length=180)
    @field_validator('seed')
    @classmethod
    def not_blank(cls,v):
        if len(v.strip())<2: raise ValueError('请输入至少两个字符的问题')
        return v.strip()


class Position(Strict):
    x: float=Field(ge=-1000,le=1000)
    z: float=Field(ge=-1000,le=1000)
    yaw: float=Field(default=0,ge=-10000,le=10000)
    pitch: float=Field(default=0,ge=-1.4,le=1.4)


class JourneyInput(Strict):
    worldId: str=Field(max_length=80)
    revision: int=Field(ge=0)
    title: str=Field(min_length=1,max_length=180)
    position: Position
    visited: list[str]=Field(default_factory=list,max_length=100)
    trace: list[dict]=Field(default_factory=list,max_length=3000)
    bag: list[dict]=Field(default_factory=list,max_length=300)
    thoughts: list[dict]=Field(default_factory=list,max_length=300)
    bridges: list[dict]=Field(default_factory=list,max_length=200)
    startedAt: str=Field(max_length=60)
    updatedAt: str=Field(max_length=60)


class AnchorInput(Strict):
    worldId: str=Field(max_length=80)
    nodeId: str=Field(max_length=80)
    text: str=Field(min_length=1,max_length=2000)
    visibility: Literal['private','public']='private'
    @field_validator('text')
    @classmethod
    def text_not_empty(cls,v):
        if not v.strip(): raise ValueError('想法不能为空')
        return v.strip()


class PublishInput(Strict):
    confirm: Literal[True]
    alias: str=Field(min_length=1,max_length=40)


class ReportInput(Strict):
    reason: str=Field(min_length=2,max_length=500)
