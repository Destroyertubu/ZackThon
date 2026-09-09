from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class Model(BaseModel):
    model_config=ConfigDict(extra='forbid', allow_inf_nan=False)
class Vec3(Model):
    x: float=Field(ge=-2000,le=2000)
    y: float=Field(ge=-200,le=200)
    z: float=Field(ge=-2000,le=2000)
class Camera(Model):
    yaw: float=Field(default=0,ge=-10000,le=10000)
    pitch: float=Field(default=.25,ge=-1.05,le=1.22)
    distance: float=Field(default=5,ge=2,le=10)
class ReturnContext(Model):
    position: Vec3
    yaw: float=0
    camera: Camera=Field(default_factory=Camera)
    trackedNodeId: str|None=None
    navigationMode: int=Field(default=0,ge=0,le=2)
class Checkpoint(ReturnContext):
    worldVersion: int=Field(ge=1)
    scene: Literal['world','field']='world'
    fieldId: str|None=None
    returnContext: ReturnContext|None=None
class WorldCreate(Model):
    seedText: str|None=Field(default=None,max_length=100)
    seedMode: Literal['search','preset','knowledge','demo']='demo'
    presetId: str|None=Field(default=None,max_length=200)
    @field_validator('seedText')
    @classmethod
    def seed_valid(cls,v):
        if v is not None:
            v=v.strip()
            if len(v)<2: raise ValueError('问题需要 2–100 个字符')
        return v
class Expand(Model):
    nodeId: str=Field(max_length=200)
    expectedVersion: int=Field(ge=1)
class FieldCreate(Model):
    snapshotId: str
    templateType: Literal['argument']='argument'
class BagCreate(Model):
    targetType: Literal['topic','content','excerpt','insight']
    targetId: str=Field(max_length=200)
    journeyId: str|None=None
class BagPatch(Model):
    expectedVersion: int=Field(ge=1)
    tags: list[str]|None=Field(default=None,max_length=10)
    note: str|None=Field(default=None,max_length=1000)
    @field_validator('tags')
    @classmethod
    def tags_valid(cls,v):
        if v is not None and any(len(t)>30 for t in v): raise ValueError('标签最多 30 字')
        return v
class LinkCreate(Model):
    sourceBagItemId: str
    targetBagItemId: str
    note: str=Field(default='',max_length=500)
class AnchorCreate(Model):
    journeyId: str
    topicId: str
    contentId: str|None=None
    excerptId: str|None=None
    localOffset: Vec3=Field(default_factory=lambda:Vec3(x=1,y=0,z=1))
    text: str=Field(min_length=1,max_length=500)
    visibility: Literal['private']='private'
    @field_validator('text')
    @classmethod
    def nonblank(cls,v):
        if not v.strip(): raise ValueError('想法不能为空白')
        return v.strip()
class AnchorPatch(Model):
    expectedVersion: int=Field(ge=1)
    text: str=Field(min_length=1,max_length=500)
    visibility: Literal['private']='private'
    @field_validator('text')
    @classmethod
    def nonblank(cls,v):
        if not v.strip(): raise ValueError('想法不能为空白')
        return v.strip()
class CPWrite(Model):
    expectedVersion: int=Field(ge=1)
    checkpoint: Checkpoint
class Version(Model):
    expectedVersion: int=Field(ge=1)
class Lease(Version):
    takeover: bool=False
class Event(Model):
    eventId: str=Field(min_length=8,max_length=100)
    type: Literal['topic_entered','topic_left','content_opened','content_closed','field_entered','field_exited','navigation_started']
    topicId: str|None=None
    worldNodeId: str|None=None
    occurredAt: str=Field(max_length=60)
    payload: dict=Field(default_factory=dict)
class Events(Model):
    events: list[Event]=Field(max_length=50)
class Synthesis(Model):
    bagItemIds: list[str]=Field(min_length=2,max_length=4)
    question: str=Field(default='',max_length=200)
    mode: Literal['ai','manual']='manual'
class InsightSave(Model):
    title: str=Field(min_length=1,max_length=100)
    coreInsight: str=Field(min_length=1,max_length=2000)
    connection: str=Field(default='',max_length=2000)
    uncertainty: str=Field(default='',max_length=1000)
    questions: list[str]=Field(default_factory=list,max_length=3)
    personalNote: str=Field(default='',max_length=1000)
class ClearData(Model):
    confirm: Literal['DELETE_MY_DATA']
